/* /api/prefs — reader settings shared across devices (Tim, 2026-09-24).

   One record per reader holds text size, font, pinned books and bookmarks.
   Text size and font are { value, t }: the newer setting wins. Pins and
   bookmarks are sets, { items: { id: { t, … } } }, merged item by item, so a
   pin or bookmark added on the phone survives one added on the computer at the
   same time, and a removal (kept as a dated tombstone) reaches every device.

   A device joins by opening a sync link (settings.html#sync=<code>). The code
   then lives in an HttpOnly first-party cookie, set here, so Safari's 7-day
   purge of script storage does not unlink the device. A second, readable cookie
   (`bs_sync_on`) only tells the page that this browser syncs.

   Storage: the private Vercel Blob store `book-summaries-prefs`, one JSON file
   per code at prefs/<sha256(code)>.json. Reads bypass the CDN cache; writes are
   conditional on the ETag read, so a concurrent write retries its merge.

   GET              → { sync, state }            (?link=1 adds the sync link)
   POST {action}    → create | join | push | leave, each answers like GET. */
import { createHash, randomBytes } from 'node:crypto';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const CODE_COOKIE = 'bs_sync';
const FLAG_COOKIE = 'bs_sync_on';
const MAX_AGE = 400 * 24 * 3600; /* the longest cookie life browsers allow */
const CODE = /^[A-Za-z0-9_-]{22,64}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,100}\.html$/;
const FONTS = ['book', 'literata', 'classic', 'hyperlegible', 'system'];
const MARK_ID = /^[a-z0-9]{8,24}$/;
const SECTION_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_BODY = 512 * 1024;
const MAX_PINS = 300;
const MAX_MARKS = 3000;
const TOMBSTONE_DAYS = 180; /* a removal older than this has reached every device */

const PREFIX = process.env.PREFS_PREFIX || 'prefs/'; /* tests write under their own prefix */
const blobPath = code => PREFIX + createHash('sha256').update(code).digest('hex') + '.json';

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/* keep the newest `max` items, dropping old tombstones first */
function trim(items, max, isGone) {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 864e5;
  const ids = Object.keys(items).filter(id => !(isGone(items[id]) && items[id].t < cutoff));
  ids.sort((a, b) => items[b].t - items[a].t);
  const out = {};
  for (const id of ids.slice(0, max)) out[id] = items[id];
  return out;
}

/* keep only well-formed settings; a time from the future is pulled back to now */
function clean(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  const now = Date.now();
  const time = t => (Number.isFinite(t) && t > 0 ? Math.min(Math.round(t), now) : 0);
  const s = input.textScale;
  if (s && Number.isFinite(s.value) && s.value >= 0.8 && s.value <= 1.6) {
    out.textScale = { value: Math.round(s.value * 100) / 100, t: time(s.t) };
  }
  const f = input.font;
  if (f && FONTS.includes(f.value)) out.font = { value: f.value, t: time(f.t) };

  const p = input.pins;
  if (p && typeof p === 'object') {
    const items = {};
    if (Array.isArray(p.value)) {
      /* the first format: a whole list with one time, newest pin first */
      const base = time(p.t);
      p.value.filter(v => typeof v === 'string' && SLUG.test(v)).forEach((slug, i) => {
        if (!items[slug]) items[slug] = { t: Math.max(base - i, 0), on: 1 };
      });
    } else if (p.items && typeof p.items === 'object') {
      for (const [slug, v] of Object.entries(p.items)) {
        if (SLUG.test(slug) && v && typeof v === 'object') items[slug] = { t: time(v.t), on: v.on ? 1 : 0 };
      }
    }
    out.pins = { items: trim(items, MAX_PINS, v => !v.on) };
  }

  const m = input.bookmarks;
  if (m && m.items && typeof m.items === 'object') {
    const items = {};
    for (const [id, v] of Object.entries(m.items)) {
      if (!MARK_ID.test(id) || !v || typeof v !== 'object' || !SLUG.test(v.b)) continue;
      if (v.d) { items[id] = { b: v.b, t: time(v.t), d: 1 }; continue; }
      items[id] = {
        b: v.b,
        t: time(v.t),
        c: time(v.c) || time(v.t),
        i: Number.isInteger(v.i) && v.i >= 0 && v.i < 1e6 ? v.i : 0,
        f: Number.isFinite(v.f) ? Math.min(Math.max(Math.round(v.f * 1000) / 1000, 0), 1) : 0,
        s: typeof v.s === 'string' && SECTION_ID.test(v.s) ? v.s : '',
        x: text(v.x, 120),
        l: text(v.l, 160),
        n: text(v.n, 160),
      };
    }
    out.bookmarks = { items: trim(items, MAX_MARKS, v => v.d) };
  }
  return out;
}

/* per item, the newer copy wins */
function mergeItems(a, b) {
  const out = { ...a };
  for (const [id, v] of Object.entries(b || {})) {
    if (!out[id] || v.t > out[id].t) out[id] = v;
  }
  return out;
}

/* newer wins, per setting; pins and bookmarks merge item by item */
function merge(stored, incoming) {
  const out = { ...stored };
  for (const key of ['textScale', 'font']) {
    const a = stored[key], b = incoming[key];
    if (b && (!a || b.t > a.t)) out[key] = b;
  }
  for (const key of ['pins', 'bookmarks']) {
    if (incoming[key]) out[key] = { items: mergeItems(stored[key] ? stored[key].items : {}, incoming[key].items) };
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Once a record passes about 1 KB the store serves it compressed, and a compressed
   response carries a WEAK ETag (W/"…"). A conditional write never matches a weak
   tag, so every save failed from then on (measured 2026-09-24). Ask for the bytes
   uncompressed, and drop any W/ that still comes back. */
const strongTag = etag => String(etag || '').replace(/^W\//, '');

async function load(code) {
  const found = await get(blobPath(code), { access: 'private', useCache: false, headers: { 'accept-encoding': 'identity' } });
  if (!found || found.statusCode !== 200 || !found.stream) return null;
  const text = await new Response(found.stream).text();
  let state = {};
  try { state = clean(JSON.parse(text)); } catch { state = {}; }
  return { state, etag: strongTag(found.blob.etag) };
}

async function save(code, state, etag) {
  await put(blobPath(code), JSON.stringify(state), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
  });
}

/* read, merge, write back only if something changed; retry when another write lands first */
/* Two devices writing at once: the store answers the loser either with a failed
   ETag precondition or, while the other write is still in flight, "The conditional
   request cannot succeed due to a conflicting operation" (a plain BlobError).
   Both mean: wait a moment, read again, merge again. Measured 2026-09-24. */
function isWriteConflict(err) {
  return err instanceof BlobPreconditionFailedError || /conditional request|conflicting operation|precondition/i.test(String(err && err.message));
}

async function update(code, incoming) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await load(code);
    if (!current) return null;
    const next = merge(current.state, incoming);
    if (same(next, current.state)) return next;
    try {
      await save(code, next, current.etag);
      return next;
    } catch (err) {
      if (process.env.PREFS_DEBUG) console.error('attempt', attempt, err && err.constructor && err.constructor.name, err && err.message, 'etag', current.etag);
      if (!isWriteConflict(err)) throw err;
      await new Promise(done => setTimeout(done, 80 + Math.random() * 220 * (attempt + 1)));
    }
  }
  throw new Error('prefs: too many concurrent writes');
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim());
  }
  return out;
}

function setSyncCookies(res, code) {
  const secure = res.__secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', code
    ? [`${CODE_COOKIE}=${code}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
       `${FLAG_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`]
    : [`${CODE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
       `${FLAG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`]);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function linkFor(req, code) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'book-summaries-umber.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('127.') || host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/settings.html#sync=${code}`;
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  res.__secure = !(host.startsWith('127.') || host.startsWith('localhost'));
  try {
    const code = cookies(req)[CODE_COOKIE];
    const known = code && CODE.test(code) ? code : null;

    if (req.method === 'GET') {
      if (!known) return send(res, 200, { sync: false });
      const current = await load(known);
      if (!current) { setSyncCookies(res, null); return send(res, 200, { sync: false }); }
      setSyncCookies(res, known); /* sliding: every visit renews the 400 days */
      const url = new URL(req.url, 'http://x');
      return send(res, 200, { sync: true, state: current.state, ...(url.searchParams.get('link') ? { link: linkFor(req, known) } : {}) });
    }

    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'method' }); }
    if (!String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'json only' });
    /* Vercel's helpers parse the body before readBody sees it, so size it from the header too */
    if (Number(req.headers['content-length'] || 0) > MAX_BODY) return send(res, 413, { error: 'too large' });

    const body = await readBody(req);
    const incoming = clean(body.state);

    if (body.action === 'create') {
      if (known && (await load(known))) {
        const state = await update(known, incoming);
        setSyncCookies(res, known);
        return send(res, 200, { sync: true, state, link: linkFor(req, known) });
      }
      const fresh = randomBytes(18).toString('base64url');
      await save(fresh, incoming, null);
      setSyncCookies(res, fresh);
      return send(res, 200, { sync: true, state: incoming, link: linkFor(req, fresh) });
    }

    if (body.action === 'join') {
      const joining = typeof body.code === 'string' && CODE.test(body.code) ? body.code : null;
      const state = joining ? await update(joining, incoming) : null;
      if (!state) return send(res, 404, { error: 'That sync link is not recognised.' });
      setSyncCookies(res, joining);
      return send(res, 200, { sync: true, state });
    }

    if (body.action === 'push') {
      const state = known ? await update(known, incoming) : null;
      if (!state) { setSyncCookies(res, null); return send(res, 200, { sync: false }); }
      return send(res, 200, { sync: true, state });
    }

    if (body.action === 'leave') {
      setSyncCookies(res, null);
      return send(res, 200, { sync: false });
    }

    return send(res, 400, { error: 'unknown action' });
  } catch (err) {
    console.error('prefs error', err && err.message);
    return send(res, err && err.status ? err.status : 500, { error: 'Sync is unavailable right now.' });
  }
}
