// Posts each live Short as a Reel on the Parachar Instagram account and Facebook Page through Meta's Graph API
// (straight from GitHub, no Make ops). Runs after comment.js, which waits for the Short to go live on YouTube.
// Reads videos/published/youtube.json (video id, publish time, release tag) and records what it posted in
// videos/published/meta.json so nothing goes out twice.
// Usage: META_TOKEN=... [META_PAGE_ID=...] [META_IG_ID=...] node meta.js          post what is due
//        META_TOKEN=... node meta.js ids                                         print the Page and Instagram ids
//        META_TOKEN=... node meta.js test <spec id>                              post one already-live Short now
//        META_TOKEN=... node meta.js check <spec id>                             show the live links of a recorded post
const fs = require('fs'), path = require('path');

const G = 'https://graph.facebook.com/v21.0';
const token = process.env.META_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || 'ny9813136114/parachar-social';
const pub = path.join(__dirname, 'videos', 'published');
const ytLog = path.join(pub, 'youtube.json'), metaLog = path.join(pub, 'meta.json');
// Only Shorts that go live after Meta posting was switched on; older ones are not backfilled.
const SINCE = Date.parse(process.env.META_SINCE || '2026-10-24T00:00:00Z');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function graph(method, p, params = {}, tok = token) {
  const url = new URL(G + p);
  const body = new URLSearchParams({ ...params, access_token: tok });
  const res = method === 'GET' ? await fetch(`${url}?${body}`) : await fetch(url, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${method} ${p}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}

// The Page the token can manage (named Parachar if there are several) and its linked Instagram account.
async function ids() {
  if (process.env.META_PAGE_ID && process.env.META_IG_ID) return { page: process.env.META_PAGE_ID, ig: process.env.META_IG_ID };
  const { data = [] } = await graph('GET', '/me/accounts', { fields: 'id,name,instagram_business_account' });
  const p = data.find(x => /parachar/i.test(x.name)) || data[0];
  if (!p) throw new Error('the token sees no Facebook Page; assign the Page to the system user');
  if (!p.instagram_business_account) throw new Error(`Page "${p.name}" has no linked Instagram professional account`);
  return { page: p.id, pageName: p.name, ig: p.instagram_business_account.id };
}

function spec(id) {
  const f = fs.readdirSync(pub).find(n => n.endsWith(`-${id}.json`) && /^\d{4}-/.test(n));
  return f ? JSON.parse(fs.readFileSync(path.join(pub, f), 'utf8')) : null;
}

// Caption: the hook title, the plain-language paragraph, the Google search line (Instagram links don't click),
// the viewer question and the hashtags. Each part comes from that video's own spec, so no two captions match.
function caption(s) {
  const title = s.title.replace(/\s*#shorts\s*$/i, '');
  return [title, s.about, `🔍 Google पर खोजें: ${s.search}\n🔗 सारे फ्री कैलकुलेटर: लिंक बायो में`,
    s.question, (s.hashtags || []).join(' ')].filter(Boolean).join('\n\n').slice(0, 2100);
}

async function instagram(igId, videoUrl, text) {
  const { id } = await graph('POST', `/${igId}/media`, { media_type: 'REELS', video_url: videoUrl, caption: text, share_to_feed: 'true' });
  for (let i = 0; i < 40; i++) { // Instagram fetches and processes the video first (usually under 2 minutes)
    await sleep(15e3);
    const { status_code: st, status } = await graph('GET', `/${id}`, { fields: 'status_code,status' });
    if (st === 'FINISHED') return (await graph('POST', `/${igId}/media_publish`, { creation_id: id })).id;
    if (st === 'ERROR' || st === 'EXPIRED') throw new Error(`Instagram could not process the video: ${status}`);
  }
  throw new Error('Instagram processing took over 10 minutes');
}

async function facebook(pageId, videoUrl, text) {
  const { access_token: pt } = await graph('GET', `/${pageId}`, { fields: 'access_token' });
  const { video_id } = await graph('POST', `/${pageId}/video_reels`, { upload_phase: 'start' }, pt);
  const up = await fetch(`https://rupload.facebook.com/video-upload/v21.0/${video_id}`,
    { method: 'POST', headers: { Authorization: `OAuth ${pt}`, file_url: videoUrl } });
  if (!up.ok) throw new Error(`Facebook upload: ${up.status} ${(await up.text()).slice(0, 200)}`);
  await graph('POST', `/${pageId}/video_reels`, { upload_phase: 'finish', video_id, video_state: 'PUBLISHED', description: text }, pt);
  return video_id;
}

async function postOne(key, v, acc, done) {
  const s = spec(key);
  if (!s) return console.log(`::warning::${key}: spec not found in videos/published, skipped`);
  const url = `https://github.com/${repo}/releases/download/${v.release}/${key}.mp4`;
  const rec = done[key] || (done[key] = {});
  const text = caption(s);
  for (const [net, fn, target] of [['instagram', instagram, acc.ig], ['facebook', facebook, acc.page]]) {
    if (rec[net]) continue;
    try { rec[net] = await fn(target, url, text); console.log(`${key}: ${net} posted (${rec[net]})`); }
    catch (e) { console.log(`::warning::${key}: ${net} failed: ${e.message}`); }
  }
}

(async () => {
  if (!token) return console.log('META_TOKEN not set; Meta posting is off');
  const acc = await ids();
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'ids') return console.log(JSON.stringify(acc));
  if (cmd === 'check') { // confirm a recorded post is really live on both
    const r = JSON.parse(fs.readFileSync(metaLog, 'utf8'))[arg] || {};
    if (r.instagram) console.log('instagram', JSON.stringify(await graph('GET', `/${r.instagram}`, { fields: 'permalink,media_product_type,timestamp' })));
    if (r.facebook) {
      const { access_token: pt } = await graph('GET', `/${acc.page}`, { fields: 'access_token' });
      console.log('facebook', JSON.stringify(await graph('GET', `/${r.facebook}`, { fields: 'permalink_url,status,published' }, pt)));
    }
    return;
  }
  const yt = fs.existsSync(ytLog) ? JSON.parse(fs.readFileSync(ytLog, 'utf8')) : {};
  const done = fs.existsSync(metaLog) ? JSON.parse(fs.readFileSync(metaLog, 'utf8')) : {};
  const due = cmd === 'test' ? [[arg, yt[arg]]]
    : Object.entries(yt).filter(([k, v]) => v.release && Date.parse(v.publishAt) <= Date.now() && Date.parse(v.publishAt) >= SINCE
        && !(done[k] && done[k].instagram && done[k].facebook));
  for (const [k, v] of due) {
    if (!v || !v.release) { console.log(`::warning::${k}: no release tag recorded, skipped`); continue; }
    await postOne(k, v, acc, done);
    fs.writeFileSync(metaLog, JSON.stringify(done, null, 2) + '\n');
  }
  if (!due.length) console.log('nothing due for Instagram/Facebook');
})().catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });
