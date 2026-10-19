// Parachar long-form engine: weekly explainer spec (chapters of slides) -> 1920x1080 MP4 + thumbnail + upload.json
// with YouTube chapters and clickable tool links in the description.
// Usage: node render-long.js videos/long/2026-10-25-post-office-schemes.json [--fps 25] [--preview]
// Same env as render.js: TTS_ENGINE / TTS_VOICE (voice), MUSIC=on, PEXELS_API_KEY (footage).
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const args = process.argv.slice(2);
const specPath = args.find(a => a.endsWith('.json'));
const fps = Number(args[args.indexOf('--fps') + 1]) || 25;
const previewOnly = args.includes('--preview');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const out = path.join(__dirname, 'out', spec.id);
fs.mkdirSync(out, { recursive: true });
const run = (cmd, a, opts) => execFileSync(cmd, a, { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
const audioLen = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const slides = spec.chapters.flatMap(c => c.slides);
const ts = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };

// Without a voice (preview) a slide lasts about as long as its line takes to read aloud.
slides.forEach(s => { s.dur = s.dur || Math.max(4, +(String(s.say || '').split(/\s+/).length * 0.42 + 1.2).toFixed(2)); });
const tts = process.env.TTS_ENGINE && process.env.TTS_ENGINE !== 'off' && !previewOnly;
const music = process.env.MUSIC === 'on' && !previewOnly;
if (tts) {
  const env = spec.voice ? { ...process.env, TTS_VOICE: spec.voice } : process.env;
  const voiceDir = path.join(out, 'voice');
  run('python3', [path.join(__dirname, 'tts.py'), voiceDir], { input: JSON.stringify(slides.map(s => s.say || '')), env });
  slides.forEach((s, i) => {
    const f = path.join(voiceDir, `scene-${i}.wav`);
    if (fs.existsSync(f)) { s.voice = f; s.dur = +(audioLen(f) + 0.8).toFixed(2); }
  });
}

(async () => {
  let clips = null;
  if (!previewOnly) {
    // One clip per slide: the slide's own query, else its chapter's queries in turn.
    const queries = spec.chapters.flatMap(c => { const pool = [].concat(c.broll || spec.broll || 'indian city street');
      return c.slides.map((s, i) => s.broll || pool[i % pool.length]); });
    try { clips = await require('./bg.js')(spec, path.join(out, 'clips'), { orientation: 'landscape', queries }); }
    catch (e) { console.log(`::warning::footage failed for ${spec.id} (${e.message}), using the plain background`); }
  }
  spec.footage = !!clips;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'engine-long.html'));
  await page.evaluate(() => window.preload());
  const { duration, chapters, cues } = await page.evaluate(s => window.build(s), spec);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  console.log(`${spec.id}: ${slides.length} slides, ${(duration / 60).toFixed(1)} min${clips ? ', footage' : ', no footage'}`);

  if (previewOnly) {
    let t = 0;
    for (const [i, s] of slides.entries()) {
      await page.evaluate(x => window.seek(x), t + s.dur - 0.4);
      await page.screenshot({ path: path.join(out, `frame-${String(i + 1).padStart(2, '0')}-${s.type}.png`) });
      t += s.dur;
    }
  } else {
    const mp4 = path.join(out, spec.id + '.mp4'), silent = path.join(out, 'video-only.mp4');
    const vin = [], vf = [];
    if (clips) {
      // Each slide's clip: slow push-in and drift, darkened a little; the page (transparent PNG) goes on top.
      slides.forEach((s, i) => {
        vin.push('-stream_loop', '-1', '-t', String(s.dur), '-i', clips[i].file);
        const dx = i % 2 ? -1 : 1;
        vf.push(`[${i + 1}:v]fps=${fps},scale=2112:1188:force_original_aspect_ratio=increase,crop=2112:1188,` +
          `crop=1920:1080:x='96+${dx}*70*t/${s.dur}':y='54-30*t/${s.dur}',setsar=1,eq=saturation=1.05:brightness=-0.04,trim=duration=${s.dur},setpts=PTS-STARTPTS[c${i}]`);
      });
      vf.push(`${slides.map((_, i) => `[c${i}]`).join('')}concat=n=${slides.length}:v=1:a=0[bgv]`,
        `[0:v]format=rgba[fg]`, `[bgv][fg]overlay=0:0:format=auto,format=yuv420p[v]`);
    }
    const an = clips ? slides.length + 1 : 1;
    // Bitrate is capped so a 7-8 minute video stays well under 100 MB for the Make upload.
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', clips ? 'png' : 'mjpeg', '-i', '-', ...vin,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      ...(clips ? ['-filter_complex', vf.join(';'), '-map', '[v]', '-map', `${an}:a`] : []),
      '-shortest', '-t', duration.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-maxrate', '1500k', '-bufsize', '3000k',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', (tts || music) ? silent : mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.ceil(duration * fps);
    for (let f = 0; f < n; f++) {
      await page.evaluate(t => window.seek(t), f / fps);
      const buf = await page.screenshot(clips ? { type: 'png', omitBackground: true } : { type: 'jpeg', quality: 90 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    if (tts || music) {
      // Voice lines go into one track first (amix of ~40 inputs is slow and quiet), then music ducks under it.
      const voiceTrack = path.join(out, 'voice.wav');
      if (tts) {
        const list = [];
        let t = 0;
        for (const [i, s] of slides.entries()) {
          const pad = path.join(out, 'voice', `pad-${i}.wav`);
          run('ffmpeg', ['-y', '-loglevel', 'error', ...(s.voice ? ['-i', s.voice] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono']),
            '-af', `adelay=150,apad`, '-t', String(s.dur), '-ar', '44100', '-ac', '1', pad]);
          list.push(`file '${pad}'`); t += s.dur;
        }
        fs.writeFileSync(path.join(out, 'voice', 'list.txt'), list.join('\n'));
        run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'voice', 'list.txt'), '-c', 'pcm_s16le', voiceTrack]);
      }
      const ins = ['-i', silent];
      if (tts) ins.push('-i', voiceTrack);
      if (music) { const m = path.join(out, 'music.wav'); run('python3', [path.join(__dirname, 'music.py'), String(duration), spec.id, m]); ins.push('-i', m); }
      const f = tts && music ? `[1:a]volume=1.6,asplit=2[vs][vo];[2:a]volume=0.32[m];[m][vs]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[md];[vo][md]amix=inputs=2:normalize=0,alimiter=limit=0.9[a]`
        : tts ? `[1:a]volume=1.6,alimiter=limit=0.9[a]` : `[1:a]volume=0.5[a]`;
      run('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', f, '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-t', duration.toFixed(2), '-movflags', '+faststart', mp4]);
      fs.rmSync(silent);
    }
    console.log(`${spec.id}.mp4: ${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB`);
  }

  // Thumbnail: big text over a still from the first clip (owner uploads it in Studio; the API needs a verified channel).
  await page.evaluate(s => window.thumb(s), spec);
  await page.evaluate(() => document.fonts.ready);
  const thPage = path.join(out, 'thumb-layer.png'), thumb = path.join(out, 'thumbnail.png');
  await page.screenshot({ path: thPage, omitBackground: !!clips });
  if (clips) run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', clips[0].file, '-i', thPage, '-filter_complex',
    '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080[b];[b][1:v]overlay=0:0,scale=1280:720', '-frames:v', '1', thumb]);
  else run('ffmpeg', ['-y', '-loglevel', 'error', '-i', thPage, '-vf', 'scale=1280:720', thumb]);
  fs.rmSync(thPage);
  await browser.close();

  // YouTube chapters: first at 0:00, at least 3, each 10 s or longer (else YouTube ignores them).
  const chapterLines = chapters.map(c => `${ts(c.start)} ${c.title}`);
  const toolLinks = [...new Map(spec.chapters.filter(c => c.url).map(c => [c.url, `• ${c.tool || c.title}: ${c.url}`])).values()];
  const plId = (JSON.parse(fs.readFileSync(path.join(__dirname, 'playlists.json'), 'utf8')))[spec.playlist] || '';
  const description = [
    spec.seoIntro, `👉 फ्री कैलकुलेटर: ${spec.url}`, '',
    spec.description, '',
    '⏱ इस वीडियो में:', ...chapterLines, '',
    ...(toolLinks.length ? ['🔗 वीडियो में दिखाए गए फ्री टूल:', ...toolLinks, ''] : []),
    ...(spec.about ? [spec.about, ''] : []),
    ...(spec.trust ? [spec.trust, ''] : []),
    ...(plId ? [`▶ ऐसे और वीडियो (${spec.playlist}): https://www.youtube.com/playlist?list=${plId}`] : []),
    '🧮 सभी फ्री कैलकुलेटर और टूल: https://parachar.com/tools/', '', spec.hashtags.join(' '),
  ].join('\n').replace(/[<>]/g, '').slice(0, 4900);
  fs.writeFileSync(path.join(out, 'upload.json'), JSON.stringify({
    id: spec.id, title: spec.title.replace(/[<>]/g, ''), description, language: spec.language || 'hi',
    tags: spec.tags, playlist: spec.playlist || '', playlistId: plId,
    comment: `${spec.question ? spec.question + '\n\n' : ''}फ्री कैलकुलेटर: ${spec.url}`,
  }, null, 2));
  fs.writeFileSync(path.join(out, 'chapters.txt'), chapterLines.join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'captions.srt'), cues.map((c, i) => `${i + 1}\n${srt(c.start)} --> ${srt(c.end)}\n${c.text}\n`).join('\n'));
  console.log(`${spec.id}: ${(duration / 60).toFixed(1)} min -> ${out}\n${chapterLines.join('\n')}`);
})().catch(e => { console.error(e); process.exit(1); });

function srt(s) { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; }
