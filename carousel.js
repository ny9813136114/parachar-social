// Carousel builder (services look): JSON spec -> 1080x1350 PNG slides (+ optional PDF for LinkedIn).
// Usage: node carousel.js <spec.json> [outDir]     default outDir: social/ig/media/<id>/
//        add "pdf": "linkedin/media/<name>.pdf" in the spec to also write a PDF of the slides.
// Spec: { "id", "type": "carousel", "save": "Save karo", "slides": [ {kind: cover|point|cta, title, sub, box, keyword} ], "caption" }
// *word* = highlighted. Slide 1 should be a cover, the last a cta.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');

function html(spec, s, i, n) {
  const dark = s.kind !== 'point';
  const num = String(i + 1).padStart(2, '0');
  const body = s.kind === 'cta'
    ? `<h1>${rich(s.title)}</h1>${s.keyword ? `<div class="kw">${esc(s.keyword)}</div>` : ''}${s.sub ? `<p class="sub">${rich(s.sub)}</p>` : ''}<div class="url">parachar.in</div>`
    : `<h1>${rich(s.title)}</h1>${s.sub ? `<p class="sub">${rich(s.sub)}</p>` : ''}${s.box ? `<div class="box">${rich(s.box)}</div>` : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:B;src:url(fonts/bricolage-var-latin.woff2) format("woff2");font-weight:200 800}
@font-face{font-family:I;src:url(fonts/inter-var-latin.woff2) format("woff2");font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;font-family:I,sans-serif;position:relative;
 background:${dark ? 'linear-gradient(160deg,#1B3A5C 0%,#1F4E79 55%,#12706B 100%)' : '#fff'};color:${dark ? '#fff' : '#17375E'}}
.glow{position:absolute;right:-220px;top:-220px;width:760px;height:760px;border-radius:50%;
 background:radial-gradient(circle,${dark ? 'rgba(45,212,191,.18)' : 'rgba(20,184,166,.12)'},transparent 70%)}
.big{position:absolute;right:70px;bottom:150px;font:800 360px/1 B;color:${dark ? 'rgba(45,212,191,.08)' : 'rgba(20,184,166,.09)'}}
.pg{position:absolute;right:96px;top:58px;font:700 34px B;color:${dark ? '#5EEAD4' : '#0F766E'}}
.wrap{position:absolute;left:96px;right:96px;top:0;bottom:180px;display:flex;flex-direction:column;justify-content:center}
h1{font:800 ${s.kind === 'cover' ? 104 : 84}px/1.07 B;letter-spacing:-1.5px}
em{font-style:normal;color:${dark ? '#5EEAD4' : '#0F766E'}}
.sub{margin-top:44px;font:400 44px/1.35 I;color:${dark ? 'rgba(255,255,255,.88)' : '#5B6676'}}
.box{margin-top:52px;padding:46px 46px;border-radius:30px;background:${dark ? 'rgba(255,255,255,.08)' : '#F5F7FA'};border:2px solid ${dark ? 'rgba(255,255,255,.15)' : '#E2E7EE'};
 font:700 44px/1.4 I;color:${dark ? '#fff' : '#17375E'};position:relative;z-index:1}
.kw{margin-top:48px;align-self:flex-start;padding:22px 52px;border-radius:24px;background:#14B8A6;color:#062A2A;font:800 84px B;letter-spacing:2px}
.url{margin-top:40px;font:700 40px I;color:#5EEAD4}
.foot{position:absolute;left:96px;right:96px;bottom:58px;display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:18px;font:700 38px I}
.brand i{width:64px;height:64px;border-radius:16px;background:${dark ? '#fff' : 'transparent'};display:grid;place-items:center}
.brand img{width:${dark ? 50 : 60}px}
.save{font:700 34px I;color:${dark ? '#fff' : '#17375E'}}
</style></head><body><div class="glow"></div>${s.kind === 'cta' ? '' : `<div class="big">${num}</div>`}
<div class="pg">${i + 1}/${n}</div><div class="wrap">${body}</div>
<div class="foot"><div class="brand"><i><img src="mark.png"></i>Parachar</div><div class="save">${esc(i === n - 1 ? (spec.share || 'Share karo ↗') : (spec.save || 'Save karo 🔖'))}</div></div>
</body></html>`;
}

(async () => {
  const [specPath, outArg] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const out = outArg || path.join('social/ig/media', spec.id);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const n = spec.slides.length;
  const files = [];
  for (let i = 0; i < n; i++) {
    const tmp = path.join(__dirname, `.slide-${process.pid}.html`);
    fs.writeFileSync(tmp, html(spec, spec.slides[i], i, n));
    await page.goto('file://' + tmp); await page.evaluate(() => document.fonts.ready);
    const f = path.join(out, `slide-${i + 1}.png`);
    await page.screenshot({ path: f }); files.push(f); fs.unlinkSync(tmp);
  }
  if (spec.pdf) { // one page per slide, same size
    const imgs = files.map(f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('');
    await page.setContent(`<style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style>${imgs}`);
    await page.pdf({ path: spec.pdf, width: '1080px', height: '1350px', printBackground: true });
    console.log(`${spec.id}: PDF -> ${spec.pdf}`);
  }
  await browser.close();
  console.log(`${spec.id}: ${n} slides -> ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
