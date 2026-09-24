/* /api/prefs — reader settings shared across devices (Tim, 2026-09-24).

   Holds the three synced settings: text size, font and pinned books. Each is
   stored as { value, t } with t the time it was set, and a merge keeps the newer
   of each, so two devices never overwrite each other's later change.

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
const MAX_BODY = 16 * 1024;

const PREFIX = process.env.PREFS_PREFIX || 'prefs/'; /* tests write under their own prefix */
const blobPath = code => PREFIX + createHash('sha256').update(code).digest('hex') + '.json';

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
  if (p && Array.isArray(p.value)) {
    const pins = [...new Set(p.value.filter(v => typeof v === 'string' && SLUG.test(v)))].slice(0, 200);
    out.pins = { value: pins, t: time(p.t) };
  }
  return out;
}

/* newer wins, per setting. On a join both devices' pins are kept. */
function merge(stored, incoming, { unionPins = false } = {}) {
  const out = { ...stored };
  for (const key of ['textScale', 'font', 'pins']) {
    const a = stored[key], b = incoming[key];
    if (!b) continue;
    if (!a || b.t > a.t) out[key] = b;
  }
  if (unionPins && stored.pins && incoming.pins) {
    const newer = incoming.pins.t > stored.pins.t ? incoming.pins : stored.pins;
    const older = newer === stored.pins ? incoming.pins : stored.pins;
    /* one tick newer than either side, so both devices take the combined list */
    out.pins = { value: [...new Set(newer.value.concat(older.value))].slice(0, 200), t: Math.max(stored.pins.t, incoming.pins.t) + 1 };
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function load(code) {
  const found = await get(blobPath(code), { access: 'private', useCache: false });
  if (!found || found.statusCode !== 200 || !found.stream) return null;
  const text = await new Response(found.stream).text();
  let state = {};
  try { state = clean(JSON.parse(text)); } catch { state = {}; }
  return { state, etag: found.blob.etag };
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
async function update(code, incoming, options) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await load(code);
    if (!current) return null;
    const next = merge(current.state, incoming, options);
    if (same(next, current.state)) return next;
    try {
      await save(code, next, current.etag);
      return next;
    } catch (err) {
      if (!(err instanceof BlobPreconditionFailedError)) throw err;
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
      const state = joining ? await update(joining, incoming, { unionPins: true }) : null;
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
