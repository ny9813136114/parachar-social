// YouTube Data API straight from GitHub Actions (free, no Make credits), with the owner's own OAuth client.
// Secrets: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (scope https://www.googleapis.com/auth/youtube).
// send(payload) takes the same payloads publish.js, comment.js and api.js used to post to the Make webhook
// and returns Make's reply shapes, so those scripts work unchanged; without the secrets it posts to Make as before.
// Usage: node yt.js report > r.json     channel video stats and playlists for the weekly report
const fs = require('fs');

const Y = 'https://www.googleapis.com/youtube';
const direct = !!(process.env.YT_REFRESH_TOKEN && process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET);
let cached;

async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: process.env.YT_REFRESH_TOKEN,
    client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET }) });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Google token: ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  cached = { token: j.access_token, until: Date.now() + (j.expires_in - 120) * 1e3 };
  return cached.token;
}

// One API call; p is relative to /youtube, e.g. "/v3/videos?part=snippet".
async function call(method, p, body, base = Y) {
  const res = await fetch(base + p, { method, headers: { Authorization: `Bearer ${await token()}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
  const text = await res.text();
  let j = {}; try { j = text ? JSON.parse(text) : {}; } catch (e) { j = { raw: text.slice(0, 300) }; }
  return { status: res.status, body: j };
}

// Resumable upload of a local MP4: Private, scheduled with publishAt, Hindi language set in the same call.
async function upload(m) {
  const meta = { snippet: { title: m.title, description: m.description, tags: m.tags, categoryId: '27',
      defaultLanguage: m.language || 'hi', defaultAudioLanguage: m.language || 'hi' },
    status: { privacyStatus: 'private', ...(m.publishAt ? { publishAt: m.publishAt } : {}), embeddable: true,
      selfDeclaredMadeForKids: false, containsSyntheticMedia: false } };
  const data = fs.readFileSync(m.file);
  const start = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true`, {
    method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(data.length) }, body: JSON.stringify(meta) });
  const loc = start.headers.get('location');
  if (!loc) throw new Error(`upload start: ${start.status} ${(await start.text()).slice(0, 300)}`);
  const put = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: data });
  const v = await put.json().catch(() => ({}));
  if (!put.ok || !v.id) throw new Error(`upload: ${put.status} ${JSON.stringify(v).slice(0, 300)}`);
  if (m.playlistId) {
    const r = await call('POST', '/v3/playlistItems?part=snippet', { snippet: { playlistId: m.playlistId, resourceId: { kind: 'youtube#video', videoId: v.id } } });
    if (r.status !== 200) console.log(`::warning::${m.id}: playlist add failed ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  return { videoId: v.id, publishAt: v.status.publishAt || '', privacy: v.status.privacyStatus };
}

async function directReply(p) {
  if (p.action === 'comment') {
    const r = await call('POST', '/v3/commentThreads?part=snippet', p.commentBody);
    return { commented: r.body.id || '', status: String(r.status), ...(r.status === 200 ? {} : { error: r.body.error }) };
  }
  if (p.action === 'api') {
    const r = await call(p.method, p.apiPath, p.apiBody || undefined);
    return { status: String(r.status), body: r.body };
  }
  if (p.file) return upload(p);
  throw new Error('unknown payload');
}

// Response-like result, so callers keep using res.ok / res.status / res.text().
async function send(payload) {
  if (!direct) return fetch(process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  try {
    const out = JSON.stringify(await directReply(payload));
    return { ok: true, status: 200, text: async () => out };
  } catch (e) {
    return { ok: false, status: 500, text: async () => String(e.message || e) };
  }
}

// The weekly report data: every upload of the channel with stats, and the playlists (same shape as Make's reply).
async function report() {
  const ch = await call('GET', '/v3/channels?part=contentDetails&mine=true');
  const uploads = ch.body.items[0].contentDetails.relatedPlaylists.uploads, ids = [];
  for (let page = ''; ;) {
    const r = await call('GET', `/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${page ? '&pageToken=' + page : ''}`);
    ids.push(...(r.body.items || []).map(i => i.contentDetails.videoId));
    if (!(page = r.body.nextPageToken)) break;
  }
  const items = [];
  for (let i = 0; i < ids.length; i += 50)
    items.push(...((await call('GET', `/v3/videos?part=snippet,status,statistics&id=${ids.slice(i, i + 50).join(',')}`)).body.items || []));
  const playlists = (await call('GET', '/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50')).body;
  return { videos: { items }, playlists };
}

module.exports = { send, direct, call };

if (require.main === module && process.argv[2] === 'report')
  report().then(r => console.log(JSON.stringify(r))).catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });
