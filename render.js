// Parachar video engine: video JSON -> 1080x1920 MP4 + cover + captions + ready-to-paste post text.
// Usage: node render.js videos/pmegp-10-lakh.json [--fps 30] [--preview]   (--preview = 6 still frames only)
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
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
const run = (cmd, a, opts) => execFileSync(cmd, a, { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
const audioLen = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// Voice-over (TTS_ENGINE=edge|piper): each scene's `say` line is spoken, and a scene is stretched
// if its line runs longer than the scene. With MUSIC=on, generated music (no copyright) plays under it.
const tts = process.env.TTS_ENGINE && process.env.TTS_ENGINE !== 'off' && !previewOnly;
const music = process.env.MUSIC === 'on' && !previewOnly;
const voiceDir = path.join(out, 'voice');
if (tts) {
  // A spec can pick its own narrator ("voice": "hi-IN-SwaraNeural") so the channel doesn't sound the same every time.
  const env = spec.voice ? { ...process.env, TTS_VOICE: spec.voice } : process.env;
  run('python3', [path.join(__dirname, 'tts.py'), voiceDir], { input: JSON.stringify(spec.scenes.map(s => s.say || '')), env });
  spec.scenes.forEach((s, i) => {
    const f = path.join(voiceDir, `scene-${i}.wav`);
    if (fs.existsSync(f)) { s.voice = f; s.dur = Math.max(s.dur, +(audioLen(f) + 0.5).toFixed(2)); }
  });
}

// v3: pick a look so videos side by side never share a design. Specs named YYYY-MM-DD-<slot>-... rotate
// through the looks day by day and slot by slot (7 looks, so 7 videos in a row all differ); others hash the id.
const LOOKS = ['creator', 'akhbaar', 'notebook', 'tvnews', 'glass', 'poster', 'fintech'];
function pickLook() {
  const m = path.basename(specPath).match(/^(\d{4}-\d{2}-\d{2})-(\d)-/);
  if (m) return LOOKS[(Math.round(Date.parse(m[1]) / 864e5) * 3 + Number(m[2]) - 1) % LOOKS.length];
  return LOOKS[[...spec.id].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7) % LOOKS.length];
}

// Services reels (Instagram): every reel gets its own look + palette, and the pair is logged in
// social/ig/looks-used.json so no design repeats. The look comes from the content (chat-heavy -> phone,
// checklist -> notebook ...) but never one of the last 5 looks used; the palette follows the industry.
const S_LOOKS = ['midnight', 'notebook', 'block', 'phone', 'neon', 'footage'];
const PALETTES = {
  teal: { ac: '#14B8A6', ac2: '#7FE3D1' }, orange: { ac: '#EA580C', ac2: '#FDBA74' }, pink: { ac: '#DB2777', ac2: '#F9A8D4' },
  red: { ac: '#DC2626', ac2: '#FCA5A5' }, blue: { ac: '#2563EB', ac2: '#93C5FD' }, violet: { ac: '#7C3AED', ac2: '#C4B5FD' },
  green: { ac: '#16A34A', ac2: '#86EFAC' }, gold: { ac: '#B45309', ac2: '#FCD34D' },
};
const INDUSTRY = [ // [match, palette, Pexels b-roll searches]
  [/gym|fitness|yoga|dance/i, 'orange', ['gym workout', 'fitness trainer', 'gym']],
  [/salon|beauty|spa/i, 'pink', ['hair salon', 'beauty salon', 'hairdresser']],
  [/restaurant|cafe|food|bakery|kitchen/i, 'red', ['restaurant kitchen', 'cafe', 'food delivery']],
  [/school|coaching|education|tuition/i, 'blue', ['classroom students', 'teacher classroom', 'students studying']],
  [/\bca\b|tax|account|insurance|loan|finance/i, 'green', ['accountant office', 'office documents', 'calculator finance']],
  [/interior|architect|furniture|real estate|builder|property/i, 'gold', ['interior design home', 'apartment building', 'modern living room']],
  [/health|clinic|dent|doctor|physio|pharma|lab/i, 'teal', ['doctor clinic', 'dentist', 'hospital']],
  [/travel|hotel|homestay/i, 'violet', ['travel', 'hotel room', 'tourist']],
];
function industryOf(spec) { return INDUSTRY.find(([re]) => re.test(spec.industry || '')) || [null, null, ['small business owner', 'shop owner', 'office work']]; }
function pickServicesDesign() {
  const li = spec.format === 'li'; // LinkedIn keeps its own rotation and skips the loud neon look
  const logF = li ? path.join(__dirname, 'linkedin', 'looks-used.json') : path.join(__dirname, 'social', 'ig', 'looks-used.json');
  const log = fs.existsSync(logF) ? JSON.parse(fs.readFileSync(logF, 'utf8')) : [];
  const prev = log.find(x => x.id === spec.id); // re-render (dry run, then the real post) keeps the same design
  let look = process.env.LOOK || spec.look || (prev && prev.look), pal = (spec.palette && spec.palette.name) || (prev && prev.palette);
  if (!look) {
    const n = t => spec.scenes.filter(s => s.type === t).length;
    const pref = [...new Set([...(n('chat') >= 2 ? ['phone'] : []), ...(n('list') >= 2 ? ['notebook'] : []),
      ...(n('compare') || n('stat') ? ['block', 'neon'] : []), 'footage', ...S_LOOKS])].filter(l => !li || l !== 'neon');
    const recent = log.slice(li ? -4 : -5).map(x => x.look);
    look = pref.find(l => !recent.includes(l)) || pref.find(l => l !== recent[recent.length - 1]) || pref[0];
  }
  if (!pal) {
    const used = new Set(log.filter(x => x.look === look).map(x => x.palette));
    const names = Object.keys(PALETTES), want = industryOf(spec)[1];
    const lastPal = log.length ? log[log.length - 1].palette : null;
    pal = [want, ...names].find(p => p && !used.has(p) && p !== lastPal) || names.find(p => p !== lastPal) || 'teal';
  }
  spec.look = look;
  if (!spec.palette || !spec.palette.ac) spec.palette = { ...PALETTES[pal] };
  if (!previewOnly && !prev) {
    log.push({ id: spec.id, look, palette: pal, at: new Date().toISOString().slice(0, 10) });
    fs.mkdirSync(path.dirname(logF), { recursive: true });
    fs.writeFileSync(logF, JSON.stringify(log, null, 1) + '\n');
  }
}

// Sound design for services reels (SFX=off to skip): short synthesized effects, no copyright.
const SFX_SRC = {
  whoosh: 'anoisesrc=color=pink:duration=0.45:amplitude=0.6,bandpass=f=1400:width_type=h:w=1600,afade=t=in:d=0.18,afade=t=out:st=0.18:d=0.27',
  ting: "aevalsrc='0.45*sin(2*PI*1568*t)*exp(-9*t)+0.25*sin(2*PI*2349*t)*exp(-12*t)':d=0.45",
  pop: "aevalsrc='0.55*sin(2*PI*(420+900*exp(-30*t))*t)*exp(-20*t)':d=0.16",
  tick: "aevalsrc='0.35*sin(2*PI*1250*t)*exp(-45*t)':d=0.08",
  impact: "aevalsrc='0.9*sin(2*PI*(50+90*exp(-14*t))*t)*exp(-5*t)':d=0.7",
  buzz: "aevalsrc='0.25*sin(2*PI*150*t)*(1+sin(2*PI*28*t))*exp(-6*t)':d=0.3",
};
function sfxFiles(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const f = {};
  for (const [k, src] of Object.entries(SFX_SRC)) {
    f[k] = path.join(dir, `${k}.wav`);
    if (!fs.existsSync(f[k])) run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-ar', '44100', '-ac', '1', f[k]]);
  }
  return f;
}

(async () => {
  const style = process.env.ENGINE_STYLE || spec.style || 'v1';
  let clips = null;
  if (style === 'services') {
    pickServicesDesign();
    // Every services reel has real video behind it (owner, 13 Nov): each look tints it in its own colour.
    // FOOTAGE=off (or no PEXELS_API_KEY) falls back to the look's own drawn background.
    if (!previewOnly && process.env.FOOTAGE !== 'off') {
      if (!spec.broll) spec.broll = industryOf(spec)[2];
      if (process.env.TEST_CLIPS) clips = process.env.TEST_CLIPS.split(',').map(file => ({ file, credit: 'test' }));
      else try { clips = await require('./bg.js')(spec, path.join(out, 'clips')); }
      catch (e) { console.log(`::warning::footage failed for ${spec.id} (${e.message}), using the look's own background`); }
      if (clips) clips = clips.filter(c => c && c.file);
      if (clips && !clips.length) clips = null;
      spec.footage = !!clips;
    }
  }
  if (style === 'v3') {
    spec.look = process.env.LOOK || spec.look || pickLook();
    if (process.env.TEST_CLIPS) clips = process.env.TEST_CLIPS.split(',').map(file => ({ file, credit: 'test' }));
    else if (!previewOnly) {
      try { clips = await require('./bg.js')(spec, path.join(out, 'clips')); }
      catch (e) { console.log(`::warning::footage failed for ${spec.id} (${e.message}), using the look's own background`); }
    }
    spec.footage = !!clips;
  }
  const browser = await chromium.launch();
  const W = 1080, H = spec.format === 'li' ? 1350 : 1920; // LinkedIn videos are 4:5
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // ENGINE_STYLE=v2 / v3 / services (or spec.style) picks engine-v2.html / engine-v3.html / engine-services.html.
  await page.goto('file://' + path.join(__dirname, { v2: 'engine-v2.html', v3: 'engine-v3.html', services: 'engine-services.html' }[style] || 'engine.html'));
  await page.evaluate(() => window.preload && window.preload());
  const { duration, cues, look, sfx = [] } = await page.evaluate(s => window.build(s), spec);
  if (look) console.log(`${spec.id}: look ${look}${spec.palette && spec.palette.ac ? ' ' + spec.palette.ac : ''}${clips ? `, footage: ${clips.map(c => c.credit).join('; ')}` : ', no footage'}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // cover = end of the hook scene (what people see in the grid / Shorts shelf)
  const coverT = spec.scenes[0].dur - 0.4;
  await page.evaluate(t => window.seek(t), coverT);
  if (!clips) await page.screenshot({ path: path.join(out, 'cover.png') }); // with footage, taken from the MP4 below

  if (previewOnly) {
    let t = 0;
    for (const [i, s] of spec.scenes.entries()) {
      await page.evaluate(x => window.seek(x), t + s.dur - 0.35);
      await page.screenshot({ path: path.join(out, `frame-${i + 1}-${s.type}.png`) });
      t += s.dur;
    }
  } else {
    const mp4 = path.join(out, spec.id + '.mp4'), silent = path.join(out, 'video-only.mp4');
    // With footage the page is rendered transparent (PNG) and laid over the clips: one clip per scene, cut on the
    // scene change, with a slow push-in, a little hand-held sway, the look's colour grade and film grain.
    const vin = [], vf = [];
    if (clips) {
      const grade = { akhbaar: 'eq=contrast=1.05:saturation=0.75:brightness=-0.03,colorchannelmixer=.95:.1:.05:0:.05:.95:.05:0:.05:.1:.85',
        tvnews: 'eq=contrast=1.12:saturation=1.05:brightness=-0.05', poster: 'eq=contrast=1.08:saturation=1.3:brightness=-0.04',
        notebook: 'eq=saturation=0.9:brightness=-0.02', creator: 'eq=contrast=1.1:saturation=1.25:brightness=-0.03' }[spec.look] || 'eq=saturation=1.05:brightness=-0.05';
      spec.scenes.forEach((s, i) => {
        vin.push('-stream_loop', '-1', '-t', String(s.dur), '-i', clips[i % clips.length].file); // fewer clips than scenes: reuse them
        const dx = i % 2 ? -1 : 1; // the end screen's footage is blurred and darkened so faces never fight the phone card
        vf.push(`[${i + 1}:v]fps=${fps},scale=${W * 1.1}:${H * 1.1}:force_original_aspect_ratio=increase,crop=${W * 1.1}:${H * 1.1},` +
          `crop=${W}:${H}:x='${W * 0.05}+${dx}*40*t/${s.dur}+6*sin(t*1.3)':y='${H * 0.05}-60*t/${s.dur}+5*sin(t*1.7+1)',setsar=1,${grade}${s.type === 'cta' ? ',gblur=sigma=18,eq=brightness=-0.18' : ''},trim=duration=${s.dur},setpts=PTS-STARTPTS[c${i}]`);
      });
      vf.push(`${spec.scenes.map((_, i) => `[c${i}]`).join('')}concat=n=${spec.scenes.length}:v=1:a=0,noise=alls=7:allf=t[bgv]`,
        `[0:v]format=rgba[fg]`, `[bgv][fg]overlay=0:0:format=auto,format=yuv420p[v]`);
    }
    const an = clips ? spec.scenes.length + 1 : 1;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', clips ? 'png' : 'mjpeg', '-i', '-', ...vin,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      ...(clips ? ['-filter_complex', vf.join(';'), '-map', '[v]', '-map', `${an}:a`] : []),
      '-shortest', '-t', duration.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', (tts || music || (style === 'services' && process.env.SFX !== 'off' && sfx.length)) ? silent : mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.ceil(duration * fps);
    for (let f = 0; f < n; f++) {
      await page.evaluate(t => window.seek(t), f / fps);
      const buf = await page.screenshot(clips ? { type: 'png', omitBackground: true } : { type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    // sound effects at the moments the engine reported (scene changes, messages, list items, big numbers)
    const fxOn = style === 'services' && process.env.SFX !== 'off' && sfx.length > 0;
    const events = [];
    if (fxOn) {
      const files = sfxFiles(path.join(out, 'sfx'));
      for (const e of sfx.sort((a, b) => a.t - b.t)) {
        if (!files[e.k] || e.t >= duration - 0.1) continue;
        if (events.some(x => x.k === e.k && Math.abs(x.t - e.t) < 0.08)) continue;
        events.push({ ...e, file: files[e.k] });
      }
      events.splice(48);
    }
    if (tts || music || events.length) {
      // Mix: voice lines placed at their scene start; music ducks under the voice; effects on top.
      const ins = ['-i', silent], parts = [];
      let t = 0, k = 1;
      for (const s of spec.scenes) {
        if (s.voice) { ins.push('-i', s.voice); const ms = Math.round((t + 0.15) * 1000); parts.push(`[${k++}:a]adelay=${ms}|${ms}[v${k - 1}]`); }
        t += s.dur;
      }
      const voices = parts.length;
      if (music) { const m = path.join(out, 'music.wav'); run('python3', [path.join(__dirname, 'music.py'), String(duration), spec.id, m]); ins.push('-i', m); }
      const mi = k;
      let f = parts.join(';');
      const vmix = voices ? `${parts.map((_, j) => `[v${j + 1}]`).join('')}amix=inputs=${voices}:normalize=0,volume=1.6[voice]` : '';
      if (voices && music) f += `;${vmix};[voice]asplit=2[vs][vo];[${mi}:a]volume=0.5[m];[m][vs]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[md];[vo][md]amix=inputs=2:normalize=0,alimiter=limit=0.9[a]`;
      else if (voices) f += `;${vmix};[voice]alimiter=limit=0.9[a]`;
      else if (music) f = `[${mi}:a]volume=0.6[a]`;
      else f = '';
      if (events.length) {
        let ei = mi + (music ? 1 : 0);
        const fxp = events.map((e, j) => { ins.push('-i', e.file); const ms = Math.round(e.t * 1000); return `[${ei++}:a]adelay=${ms}|${ms},volume=${e.k === 'impact' ? 0.55 : 0.35}[x${j}]`; });
        const fxmix = `${fxp.join(';')};${events.map((_, j) => `[x${j}]`).join('')}amix=inputs=${events.length}:normalize=0[fx]`;
        f = f ? `${f.replace(/\[a\]$/, '[a0]')};${fxmix};[a0][fx]amix=inputs=2:normalize=0,alimiter=limit=0.9[a]` : `${fxmix};[fx]alimiter=limit=0.9[a]`;
      }
      run('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', f, '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-t', duration.toFixed(2), '-movflags', '+faststart', mp4]);
      fs.rmSync(silent);
    }
    if (clips) run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', coverT.toFixed(2), '-i', mp4, '-frames:v', '1', path.join(out, 'cover.png')]);
  }
  await browser.close();

  fs.writeFileSync(path.join(out, 'captions.srt'),
    cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'));
  if (style === 'services') { // Instagram/LinkedIn services reels: no YouTube metadata, caption comes from the spec.
    fs.writeFileSync(path.join(out, 'post.md'), `# ${spec.id} (${duration.toFixed(1)} s)\n\n## Instagram caption\n${spec.caption || ''}\n`);
    console.log(`${spec.id}: ${duration.toFixed(1)} s -> ${out}`);
    return;
  }
  const tags = spec.hashtags.join(' ');
  // YouTube SEO: keyword-first opening line and the tool link above the fold, then the facts,
  // a keyword paragraph, the source line, the playlist and the tools hub, hashtags last.
  const plId = (JSON.parse(fs.readFileSync(path.join(__dirname, 'playlists.json'), 'utf8')))[spec.playlist] || '';
  const intro = spec.seoIntro || spec.title.replace(/\s*#shorts\s*/i, '').split('|')[0].trim();
  const description = [
    intro, `👉 फ्री कैलकुलेटर: ${link}`, '',
    `${spec.description}\n${link}`,
    ...(spec.about ? ['', spec.about] : []),
    ...(spec.trust ? ['', spec.trust] : []),
    ...(plId ? ['', `▶ ऐसे और Shorts (${spec.playlist}): https://www.youtube.com/playlist?list=${plId}`] : []),
    '🧮 सभी फ्री कैलकुलेटर और टूल: https://parachar.com/tools/', '', tags,
  ].join('\n').replace(/[<>]/g, '').slice(0, 4900);
  // Machine-readable copy of the same text, used by publish.js for the automatic YouTube upload.
  fs.writeFileSync(path.join(out, 'upload.json'), JSON.stringify({
    id: spec.id,
    title: spec.title.replace(/[<>]/g, ''),
    description,
    language: spec.language || 'hi',
    tags: spec.tags || spec.hashtags.map(h => h.replace(/^#/, '')),
    playlist: spec.playlist || '',
    playlistId: plId,
    // The auto comment opens with a question to start a conversation; the link is copyable even if not clickable.
    comment: `${spec.question ? spec.question + '\n\n' : ''}फ्री कैलकुलेटर: ${link}`,
  }, null, 2));
  fs.writeFileSync(path.join(out, 'post.md'), `# ${spec.id} (${duration.toFixed(1)} s)

## YouTube Shorts
**Title:** ${spec.title}
**Description:**
${description}
**Pinned comment:** फ्री कैलकुलेटर: ${link}
**Captions file:** captions.srt (YouTube Studio → Subtitles → Upload file → With timing)
`);
  console.log(`${spec.id}: ${duration.toFixed(1)} s -> ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
