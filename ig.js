// Posts today's Parachar services post from social/ig/queue/<YYYY-MM-DD>-<slug>.json to Instagram (and the Facebook
// Page as a copy) through Meta's Graph API. Reels must already be rendered to out/<id>/ (the workflow does that and
// uploads the mp4 + cover to a GitHub release so Meta can fetch them). Carousels use the PNGs committed in
// social/ig/media/<id>/slide-N.png (public raw URLs, the repo is public).
// Usage: META_TOKEN=... node ig.js kind [date]     print "reel <file>", "carousel <file>" or "none" for the date
//        META_TOKEN=... node ig.js post [date]     post the date's file; on success move it to social/ig/published/
// A file with "needs_owner" is skipped. Log: social/ig/published/log.json (so nothing goes out twice).
const fs = require('fs'), path = require('path');

const G = 'https://graph.facebook.com/v21.0';
const token = process.env.META_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || 'ny9813136114/parachar-social';
const Q = 'social/ig/queue', PUB = 'social/ig/published', LOG = path.join(PUB, 'log.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

async function graph(method, p, params = {}, tok = token) {
  const body = new URLSearchParams({ ...params, access_token: tok });
  const res = method === 'GET' ? await fetch(`${G}${p}?${body}`) : await fetch(G + p, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${method} ${p}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}

async function ids() {
  if (process.env.META_PAGE_ID && process.env.META_IG_ID) return { page: process.env.META_PAGE_ID, ig: process.env.META_IG_ID };
  const { data = [] } = await graph('GET', '/me/accounts', { fields: 'id,name,instagram_business_account' });
  const p = data.find(x => /parachar/i.test(x.name)) || data[0];
  if (!p || !p.instagram_business_account) throw new Error('no Facebook Page with a linked Instagram account for this token');
  return { page: p.id, ig: p.instagram_business_account.id };
}

// Wait until Instagram has fetched and processed a container, then publish it.
async function publish(igId, id) {
  for (let i = 0; i < 40; i++) {
    const { status_code: st, status } = await graph('GET', `/${id}`, { fields: 'status_code,status' });
    if (st === 'FINISHED') return (await graph('POST', `/${igId}/media_publish`, { creation_id: id })).id;
    if (st === 'ERROR' || st === 'EXPIRED') throw new Error(`Instagram could not process the media: ${status}`);
    await sleep(15e3);
  }
  throw new Error('Instagram processing took over 10 minutes');
}

async function igReel(igId, videoUrl, coverUrl, caption) {
  const p = { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true' };
  if (coverUrl) p.cover_url = coverUrl;
  return publish(igId, (await graph('POST', `/${igId}/media`, p)).id);
}

async function igCarousel(igId, imageUrls, caption) {
  const children = [];
  for (const u of imageUrls) children.push((await graph('POST', `/${igId}/media`, { image_url: u, is_carousel_item: 'true' })).id);
  for (const c of children) { // each slide must finish before the parent carousel is made
    for (let i = 0; i < 20; i++) {
      const { status_code: st } = await graph('GET', `/${c}`, { fields: 'status_code' });
      if (st === 'FINISHED') break;
      if (st === 'ERROR') throw new Error(`Instagram could not process slide ${c}`);
      await sleep(5e3);
    }
  }
  const { id } = await graph('POST', `/${igId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
  return publish(igId, id);
}

async function pageToken(pageId) { return (await graph('GET', `/${pageId}`, { fields: 'access_token' })).access_token; }

async function fbReel(pageId, videoUrl, text) {
  const pt = await pageToken(pageId);
  const { video_id } = await graph('POST', `/${pageId}/video_reels`, { upload_phase: 'start' }, pt);
  const up = await fetch(`https://rupload.facebook.com/video-upload/v21.0/${video_id}`,
    { method: 'POST', headers: { Authorization: `OAuth ${pt}`, file_url: videoUrl } });
  if (!up.ok) throw new Error(`Facebook upload: ${up.status} ${(await up.text()).slice(0, 200)}`);
  await graph('POST', `/${pageId}/video_reels`, { upload_phase: 'finish', video_id, video_state: 'PUBLISHED', description: text }, pt);
  return video_id;
}

async function fbPhotos(pageId, imageUrls, text) {
  const pt = await pageToken(pageId);
  const media = [];
  for (const u of imageUrls) media.push({ media_fbid: (await graph('POST', `/${pageId}/photos`, { url: u, published: 'false' }, pt)).id });
  return (await graph('POST', `/${pageId}/feed`, { message: text, attached_media: JSON.stringify(media) }, pt)).id;
}

function todays(date) {
  if (!fs.existsSync(Q)) return null;
  const f = fs.readdirSync(Q).filter(n => n.startsWith(date) && n.endsWith('.json')).sort()[0];
  if (!f) return null;
  const spec = JSON.parse(fs.readFileSync(path.join(Q, f), 'utf8'));
  return { f, spec, kind: spec.type === 'carousel' ? 'carousel' : 'reel' };
}

(async () => {
  const [cmd, d] = process.argv.slice(2);
  const date = d || istDate();
  const t = todays(date);
  if (cmd === 'kind') return console.log(t ? (t.spec.needs_owner ? 'none' : `${t.kind} ${path.join(Q, t.f)}`) : 'none');
  if (cmd !== 'post') throw new Error('usage: node ig.js kind|post [YYYY-MM-DD]');
  if (!t) return console.log(`No Instagram post queued for ${date}.`);
  if (t.spec.needs_owner) return console.log(`::warning::${t.f} needs the owner's input (${t.spec.needs_owner}); skipped.`);
  if (!token) throw new Error('META_TOKEN not set');
  const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};
  const rec = log[t.spec.id] || (log[t.spec.id] = { date, kind: t.kind });
  const acc = await ids();
  const caption = t.spec.caption.slice(0, 2200);
  let urls;
  if (t.kind === 'reel') {
    const tag = process.env.RELEASE_TAG;
    if (!tag) throw new Error('RELEASE_TAG not set (the workflow uploads the rendered reel first)');
    const base = `https://github.com/${repo}/releases/download/${tag}/${t.spec.id}`;
    urls = { video: `${base}.mp4`, cover: `${base}-cover.png` };
  } else {
    const dir = `social/ig/media/${t.spec.id}`;
    const n = fs.readdirSync(dir).filter(x => /^slide-\d+\.png$/.test(x)).length;
    if (n < 2 || n > 10) throw new Error(`${dir}: carousel needs 2-10 slides, found ${n}`);
    urls = Array.from({ length: n }, (_, i) => `https://raw.githubusercontent.com/${repo}/main/${dir}/slide-${i + 1}.png`);
  }
  if (process.env.DRY_RUN === 'true') { // check the token, the accounts and that Meta can fetch every file; post nothing
    const ig = await graph('GET', `/${acc.ig}`, { fields: 'username' });
    console.log(`Dry run OK so far: token sees Instagram @${ig.username}, Page ${acc.page}`);
    for (const u of [].concat(t.kind === 'reel' ? [urls.video, urls.cover] : urls)) {
      const r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
      console.log(`${r.ok ? 'OK ' : 'MISSING'} ${u}`);
      if (!r.ok) throw new Error(`file not reachable: ${u}`);
    }
    return console.log(`Dry run passed for ${t.f}; nothing was posted.`);
  }
  // Instagram is the main target: if it fails the run fails. Facebook is a best-effort copy.
  if (!rec.instagram) {
    rec.instagram = t.kind === 'reel' ? await igReel(acc.ig, urls.video, urls.cover, caption) : await igCarousel(acc.ig, urls, caption);
    try { rec.permalink = (await graph('GET', `/${rec.instagram}`, { fields: 'permalink' })).permalink; } catch {}
    console.log(`Instagram posted: ${rec.permalink || rec.instagram}`);
  }
  if (!rec.facebook && process.env.FB_COPY !== 'off') {
    try { rec.facebook = t.kind === 'reel' ? await fbReel(acc.page, urls.video, caption) : await fbPhotos(acc.page, urls, caption); console.log(`Facebook copy posted: ${rec.facebook}`); }
    catch (e) { console.log(`::warning::Facebook copy failed: ${e.message}`); }
  }
  fs.mkdirSync(PUB, { recursive: true });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
  fs.renameSync(path.join(Q, t.f), path.join(PUB, t.f));
})().catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });
