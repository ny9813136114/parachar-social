// Posts the free-tool comment ("फ्री कैलकुलेटर: <link>") on each Short once it is live, through the same Make
// webhook (action "comment"). Reads and updates videos/published/youtube.json, written by publish.js.
// Usage: MAKE_WEBHOOK_URL=... node comment.js
const fs = require('fs'), path = require('path'), yt = require('./yt');
const log = path.join(__dirname, 'videos', 'published', 'youtube.json');
const hook = process.env.MAKE_WEBHOOK_URL;

(async () => {
  if ((!hook && !yt.direct) || !fs.existsSync(log)) return console.log('nothing to do');
  const all = JSON.parse(fs.readFileSync(log, 'utf8'));
  // GitHub skips many scheduled runs, so a run that finds a Short going live within WAIT_HOURS stays up
  // until then (public repo: runner minutes are free) and comments a couple of minutes after it goes live.
  const until = Date.now() + Number(process.env.WAIT_HOURS || 0) * 3600e3; // stay inside the job timeout
  for (;;) {
    const next = Object.values(all).filter(v => !v.commented && v.comment && Date.parse(v.publishAt) > Date.now())
      .map(v => Date.parse(v.publishAt)).sort((a, b) => a - b)[0];
    const due = Object.values(all).some(v => !v.commented && v.comment && Date.parse(v.publishAt) <= Date.now());
    if (!due && next && next < until) {
      const ms = next - Date.now() + 120e3;
      console.log(`waiting ${Math.round(ms / 60e3)} min for the next Short to go live`);
      await new Promise(r => setTimeout(r, ms));
      continue;
    }
    if (!due) break;
    await post(all);
    fs.writeFileSync(log, JSON.stringify(all, null, 2) + '\n');
    // A failed comment stays pending for the next run instead of being retried in a loop here.
    if (Object.values(all).some(v => !v.commented && v.comment && Date.parse(v.publishAt) <= Date.now())) break;
  }
})().catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });

async function post(all) {
  for (const [id, v] of Object.entries(all)) {
    if (v.commented || !v.comment || Date.parse(v.publishAt) > Date.now()) continue;
    // Goes straight to YouTube commentThreads.insert (yt.js, or Make when the YT_* secrets are missing).
    const commentBody = JSON.stringify({ snippet: { videoId: v.videoId, topLevelComment: { snippet: { textOriginal: v.comment } } } });
    const res = await yt.send({ action: 'comment', videoId: v.videoId, commentBody });
    const text = await res.text();
    let ok = false;
    try { const r = JSON.parse(text); ok = String(r.status) === '200' && !!r.commented; } catch (e) {}
    if (ok) { v.commented = true; console.log(`${id}: comment posted`); }
    else console.log(`::warning::${id}: comment failed (${res.status} ${text.slice(0, 200)})`);
  }
}
