// One-off YouTube Data API calls through the Make webhook (action "api"), e.g. playlist or channel settings.
// Reads an array of {name, method, path, body} from the given file and writes each reply to seo/out/<file>.json.
// Usage: MAKE_WEBHOOK_URL=... node api.js seo/<file>.json
const fs = require('fs'), path = require('path');
const file = process.argv[2], hook = process.env.MAKE_WEBHOOK_URL;

(async () => {
  if (!hook) throw new Error('MAKE_WEBHOOK_URL is not set');
  const calls = JSON.parse(fs.readFileSync(file, 'utf8')), out = {};
  for (const c of calls) {
    const res = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'api', method: c.method, apiPath: c.path, apiBody: c.body ? JSON.stringify(c.body) : '' }) });
    const text = await res.text();
    try { out[c.name] = JSON.parse(text); } catch (e) { out[c.name] = { http: res.status, text: text.slice(0, 500) }; }
    console.log(`${c.name}: ${out[c.name].status || res.status}`);
  }
  const dest = path.join(__dirname, 'seo', 'out', path.basename(file));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
})().catch(e => { console.error(`::error::${e.stack || e}`); process.exit(1); });
