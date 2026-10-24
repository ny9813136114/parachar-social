// Uploads rendered videos to YouTube as Private + scheduled: straight through the YouTube API when the YT_* secrets
// are set (yt.js, no Make credits), otherwise via the Make webhook, which downloads each MP4 from the GitHub release
// RELEASE_TAG via a short-lived signed URL.
// Usage: MAKE_WEBHOOK_URL=... RELEASE_TAG=... GH_TOKEN=... node publish.js <date YYYY-MM-DD> <out/id1> [out/id2] [out/id3]
// Slot times are IST (UTC+5:30); the n-th video gets the n-th slot.
const fs = require('fs'), path = require('path'), yt = require('./yt');

// PUBLISH_SLOTS overrides them (the weekly long video goes out on Sunday at 11:00).
const SLOTS_IST = (process.env.PUBLISH_SLOTS || '09:00,13:00,19:30').split(',');

const [date, ...dirs] = process.argv.slice(2);
const hook = process.env.MAKE_WEBHOOK_URL;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !dirs.length) {
  console.error('usage: node publish.js YYYY-MM-DD out/<id> [...]'); process.exit(2);
}

const api = (p, opts = {}) => fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${p}`,
  { ...opts, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, ...(opts.headers || {}) } });

// The release asset URL redirects to a signed download link that needs no login (valid for a few minutes).
async function signedUrl(assets, name) {
  const a = assets.find(x => x.name === name);
  if (!a) throw new Error(`${name} not in release ${process.env.RELEASE_TAG}`);
  const r = await api(`/releases/assets/${a.id}`, { headers: { Accept: 'application/octet-stream' }, redirect: 'manual' });
  const loc = r.headers.get('location');
  if (!loc) throw new Error(`no download redirect for ${name} (${r.status})`);
  return loc;
}

// A slot that has already passed (late run) goes out 15 minutes from now instead.
const publishAt = slot => new Date(Math.max(Date.parse(`${date}T${slot}:00+05:30`), Date.now() + 15 * 60e3)).toISOString();

(async () => {
  let failed = 0, assets = [];
  if (hook && !yt.direct) {
    const rel = await api(`/releases/tags/${process.env.RELEASE_TAG}`);
    if (!rel.ok) throw new Error(`release ${process.env.RELEASE_TAG}: ${rel.status}`);
    assets = (await rel.json()).assets;
  }
  for (const [i, dir] of dirs.entries()) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'upload.json'), 'utf8'));
    const slot = SLOTS_IST[i % SLOTS_IST.length];
    const at = process.env.PRIVATE_ONLY === 'true' ? '' : publishAt(slot); // test runs stay Private, never auto-publish
    if (!hook && !yt.direct) { console.log(`[dry run, no MAKE_WEBHOOK_URL or YT_* secrets] ${meta.id} -> ${at} (${slot} IST)`); continue; }
    // No caption upload (owner, 19 Oct): the text is already on screen and YouTube adds its own auto captions.
    // Hindi as the video and audio language (the upload module can't set it): a ready videos.update body.
    const snippetBody = JSON.stringify({ id: '__VIDEO_ID__', snippet: { title: meta.title, description: meta.description,
      tags: meta.tags, categoryId: '27', defaultLanguage: meta.language || 'hi', defaultAudioLanguage: meta.language || 'hi' } });
    const res = await yt.send({ ...meta, publishAt: at, fileName: meta.id + '.mp4', file: path.join(dir, meta.id + '.mp4'),
      ...(yt.direct ? {} : { videoUrl: await signedUrl(assets, meta.id + '.mp4') }), snippetBody });
    const text = (await res.text()).slice(0, 300);
    if (!res.ok) { console.error(`::error::${meta.id}: webhook ${res.status} ${text}`); failed++; continue; }
    // Remember the YouTube id so comment.js can post the free-tool comment once the Short is live.
    try {
      const { videoId } = JSON.parse(text);
      if (videoId && at) {
        const log = path.join(__dirname, 'videos', 'published', 'youtube.json');
        const all = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8')) : {};
        // release: meta.js posts the same MP4 to Instagram and Facebook from this public release.
        all[meta.id] = { videoId, publishAt: at, comment: meta.comment, commented: false, release: process.env.RELEASE_TAG };
        fs.mkdirSync(path.dirname(log), { recursive: true });
        fs.writeFileSync(log, JSON.stringify(all, null, 2) + '\n');
      }
    } catch (e) { console.log(`::warning::${meta.id}: no video id in the upload reply`); }
    console.log(`${meta.id}: sent, ${at ? `publishes ${at} (${slot} IST)` : 'Private (no publish time)'} · ${text}`);
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });
