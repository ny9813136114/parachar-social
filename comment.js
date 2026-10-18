// Posts the free-tool comment ("फ्री कैलकुलेटर: <link>") on each Short once it is live, through the same Make
// webhook (action "comment"). Reads and updates videos/published/youtube.json, written by publish.js.
// Usage: MAKE_WEBHOOK_URL=... node comment.js
const fs = require('fs'), path = require('path');
const log = path.join(__dirname, 'videos', 'published', 'youtube.json');
const hook = process.env.MAKE_WEBHOOK_URL;

(async () => {
  if (!hook || !fs.existsSync(log)) return console.log('nothing to do');
  const all = JSON.parse(fs.readFileSync(log, 'utf8'));
  for (const [id, v] of Object.entries(all)) {
    if (v.commented || !v.comment || Date.parse(v.publishAt) > Date.now()) continue;
    // Make passes this body straight to YouTube commentThreads.insert.
    const commentBody = JSON.stringify({ snippet: { videoId: v.videoId, topLevelComment: { snippet: { textOriginal: v.comment } } } });
    const res = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', videoId: v.videoId, commentBody }) });
    const text = await res.text();
    let ok = false;
    try { const r = JSON.parse(text); ok = String(r.status) === '200' && !!r.commented; } catch (e) {}
    if (ok) { v.commented = true; console.log(`${id}: comment posted`); }
    else console.log(`::warning::${id}: comment failed (${res.status} ${text.slice(0, 200)})`);
  }
  fs.writeFileSync(log, JSON.stringify(all, null, 2) + '\n');
})().catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });
