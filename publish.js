// Sends rendered videos to the Make webhook, which uploads them to YouTube as Private + scheduled.
// Usage: MAKE_WEBHOOK_URL=... node publish.js <date YYYY-MM-DD> <out/id1> [out/id2] [out/id3]
// Slot times are IST (UTC+5:30); the n-th video gets the n-th slot.
const fs = require('fs'), path = require('path');

const SLOTS_IST = ['09:00', '13:00', '19:30'];
const MAX_BYTES = 3.5 * 1024 * 1024; // base64 grows ~33%; Make webhooks take up to 5 MB

const [date, ...dirs] = process.argv.slice(2);
const hook = process.env.MAKE_WEBHOOK_URL;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !dirs.length) {
  console.error('usage: node publish.js YYYY-MM-DD out/<id> [...]'); process.exit(2);
}

const publishAt = slot => new Date(`${date}T${slot}:00+05:30`).toISOString();

(async () => {
  let failed = 0;
  for (const [i, dir] of dirs.entries()) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'upload.json'), 'utf8'));
    const mp4 = path.join(dir, meta.id + '.mp4');
    const bytes = fs.readFileSync(mp4);
    const slot = SLOTS_IST[i % SLOTS_IST.length];
    const at = publishAt(slot);
    if (bytes.length > MAX_BYTES) { console.error(`${meta.id}: ${bytes.length} bytes is too big for the webhook`); failed++; continue; }
    if (!hook) { console.log(`[dry run, no MAKE_WEBHOOK_URL] ${meta.id} -> ${at} (${slot} IST)`); continue; }
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...meta, publishAt: at, fileName: meta.id + '.mp4', video: bytes.toString('base64') }),
    });
    const text = (await res.text()).slice(0, 300);
    if (!res.ok) { console.error(`${meta.id}: webhook ${res.status} ${text}`); failed++; continue; }
    console.log(`${meta.id}: sent, publishes ${at} (${slot} IST) · ${text}`);
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
