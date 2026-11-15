// Daily Instagram image post (services): one business problem -> the exact message to copy -> why it works.
// Usage: node card.js <spec.json> [outDir]   default outDir: social/ig/media/<id>/  (writes slide-1.png, 1080x1350)
// Spec: { id, type: "image", industry, kicker, title, fix_label, message, why, caption, palette? (teal|orange|...), theme? (dark|light) }
// *word* = highlighted. Palette and theme rotate by id when not given, so consecutive days never look the same.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const PAL = { teal: ['#14B8A6', '#5EEAD4'], orange: ['#EA580C', '#FDBA74'], pink: ['#DB2777', '#F9A8D4'], red: ['#DC2626', '#FCA5A5'],
  blue: ['#2563EB', '#93C5FD'], violet: ['#7C3AED', '#C4B5FD'], green: ['#16A34A', '#86EFAC'], gold: ['#B45309', '#FCD34D'] };
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>').replace(/\n/g, '<br>'); // [blank] = fill your own
const hash = s => [...String(s)].reduce((h, c) => Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0, 2166136261);

function html(s) {
  const names = Object.keys(PAL), h = hash(s.id);
  const [ac, ac2] = PAL[s.palette] || PAL[names[h % names.length]];
  const dark = (s.theme || (h % 2 ? 'dark' : 'light')) === 'dark';
  const bg = dark ? `radial-gradient(900px 700px at 90% 0%,${ac}55,transparent 60%),linear-gradient(170deg,#0B1220,#111827)` : `radial-gradient(900px 700px at 90% 0%,${ac}22,transparent 60%),#FAF7F0`;
  const ink = dark ? '#fff' : '#111827', muted = dark ? '#CBD5E1' : '#4B5563', hi = dark ? ac2 : ac;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:B;src:url(fonts/bricolage-var-latin.woff2) format("woff2");font-weight:200 800}
@font-face{font-family:I;src:url(fonts/inter-var-latin.woff2) format("woff2");font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;background:${bg};color:${ink};font-family:I,sans-serif;position:relative}
.top{position:absolute;left:80px;right:80px;top:64px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:16px;font:800 40px B}
.brand i{width:62px;height:62px;border-radius:16px;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px ${dark ? 'transparent' : '#E5E7EB'}}
.brand img{width:46px}
.pill{font:800 26px I;letter-spacing:.08em;text-transform:uppercase;padding:12px 22px;border-radius:999px;background:${ac};color:#fff}
.wrap{position:absolute;left:80px;right:80px;top:180px;bottom:200px;display:flex;flex-direction:column;justify-content:center}
.k{font:800 28px I;letter-spacing:.1em;text-transform:uppercase;color:${hi};margin-bottom:22px}
h1{font:800 76px/1.08 B;letter-spacing:-1.5px}
h1 em{font-style:normal;color:${hi}}
.lab{margin-top:48px;font:700 30px I;color:${muted}}
.chat{margin-top:18px;background:#0B141A;border-radius:34px;padding:30px;box-shadow:0 30px 60px -30px rgba(0,0,0,.5)}
.msg{background:#005C4B;color:#fff;border-radius:26px 26px 6px 26px;padding:26px 30px;font:500 34px/1.42 I;margin-left:40px;white-space:pre-line}
.msg em{font-style:normal;font-weight:800;color:#B5F5E6}
.msg .ph{color:#FDE68A;font-weight:700}
.msg small{display:block;text-align:right;font-size:22px;color:rgba(255,255,255,.55);margin-top:8px}
.why{margin-top:34px;font:500 32px/1.4 I;color:${muted}}
.why b{color:${ink}}
.why em{font-style:normal;font-weight:700;color:${hi}}
.foot{position:absolute;left:80px;right:80px;bottom:70px;display:flex;justify-content:space-between;align-items:center}
.wa{font:800 32px I;padding:16px 28px;border-radius:999px;background:#25D366;color:#062A16}
.save{font:700 30px I;color:${muted}}
</style></head><body>
<div class="top"><div class="brand"><i><img src="mark.png"></i>Parachar</div><div class="pill">${esc(s.industry)}</div></div>
<div class="wrap">${s.kicker ? `<div class="k">${esc(s.kicker)}</div>` : ''}<h1>${rich(s.title)}</h1>
<div class="lab">${esc(s.fix_label || 'Ye message copy karo 👇')}</div>
<div class="chat"><div class="msg">${rich(s.message)}<small>WhatsApp ✓✓</small></div></div>
${s.why ? `<div class="why"><b>Kyun kaam karta hai:</b> ${rich(s.why)}</div>` : ''}</div>
<div class="foot"><div class="wa">WhatsApp 98131 36114</div><div class="save">Save karo 🔖</div></div>
</body></html>`;
}

(async () => {
  const [specPath, outArg] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const out = outArg || path.join('social/ig/media', spec.id);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const tmp = path.join(__dirname, `.card-${process.pid}.html`);
  fs.writeFileSync(tmp, html(spec));
  await page.goto('file://' + tmp); await page.evaluate(() => document.fonts.ready);
  // the card must fit: fail loudly instead of posting clipped text
  const over = await page.evaluate(() => { const w = document.querySelector('.wrap'); return w.scrollHeight > w.clientHeight + 2; });
  await page.screenshot({ path: path.join(out, 'slide-1.png') }); fs.unlinkSync(tmp);
  await browser.close();
  if (over) { console.error(`${spec.id}: text too long for the card, shorten it`); process.exit(2); }
  console.log(`${spec.id}: image -> ${out}/slide-1.png`);
})().catch(e => { console.error(e); process.exit(1); });
