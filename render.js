// Parachar video engine: video JSON -> 1080x1920 MP4 + cover + captions + ready-to-paste post text.
// Usage: node render.js videos/pmegp-10-lakh.json [--fps 30] [--preview]   (--preview = 6 still frames only)
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const args = process.argv.slice(2);
const specPath = args.find(a => a.endsWith('.json'));
const fps = Number(args[args.indexOf('--fps') + 1]) || 30;
const previewOnly = args.includes('--preview');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const out = path.join(__dirname, 'out', spec.id);
fs.mkdirSync(out, { recursive: true });

const srtTime = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
// Clean link in posts: spec.shortUrl (e.g. a bit.ly link carrying UTMs) if set, else the plain page URL.
const link = spec.shortUrl || spec.url;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'engine.html'));
  const { duration, cues } = await page.evaluate(s => window.build(s), spec);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // cover = end of the hook scene (what people see in the grid / Shorts shelf)
  const coverT = spec.scenes[0].dur - 0.4;
  await page.evaluate(t => window.seek(t), coverT);
  await page.screenshot({ path: path.join(out, 'cover.png') });

  if (previewOnly) {
    let t = 0;
    for (const [i, s] of spec.scenes.entries()) {
      await page.evaluate(x => window.seek(x), t + s.dur - 0.35);
      await page.screenshot({ path: path.join(out, `frame-${i + 1}-${s.type}.png`) });
      t += s.dur;
    }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-shortest', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(out, spec.id + '.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.ceil(duration * fps);
    for (let f = 0; f < n; f++) {
      await page.evaluate(t => window.seek(t), f / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  }
  await browser.close();

  fs.writeFileSync(path.join(out, 'captions.srt'),
    cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'));
  const tags = spec.hashtags.join(' ');
  // Machine-readable copy of the same text, used by publish.js for the automatic YouTube upload.
  fs.writeFileSync(path.join(out, 'upload.json'), JSON.stringify({
    id: spec.id,
    title: spec.title.replace(/[<>]/g, ''),
    description: `${spec.description}\n${link}\n\n${tags}`.replace(/[<>]/g, ''),
    tags: spec.tags || spec.hashtags.map(h => h.replace(/^#/, '')),
    playlist: spec.playlist || '',
    comment: `फ्री कैलकुलेटर: ${link}`,
  }, null, 2));
  fs.writeFileSync(path.join(out, 'post.md'), `# ${spec.id} (${duration.toFixed(1)} s)

## YouTube Shorts
**Title:** ${spec.title}
**Description:**
${spec.description}
${link}

${tags}
**Pinned comment:** फ्री कैलकुलेटर: ${link}
**Captions file:** captions.srt (YouTube Studio → Subtitles → Upload file → With timing)
`);
  console.log(`${spec.id}: ${duration.toFixed(1)} s -> ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
