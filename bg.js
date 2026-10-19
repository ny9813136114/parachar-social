// Real background footage for the v3 engine: finds portrait stock clips on Pexels (free licence, no credit needed)
// and downloads one per scene. Needs PEXELS_API_KEY; without it the engine uses the look's own background.
// Queries come from spec.broll (one string, or one per scene), else from the playlist's default below.
const fs = require('fs'), path = require('path');

const DEFAULTS = {
  'सरकारी सब्सिडी योजनाएँ': ['indian village farmer', 'rooftop solar panels india', 'indian small shop owner'],
  'इनकम टैक्स और सैलरी': ['indian office worker laptop', 'counting rupee notes', 'indian man calculator'],
  'बैंक, UPI और बचत योजनाएँ': ['upi payment phone india', 'indian bank', 'indian rupee notes'],
  'पेंशन और रिटायरमेंट': ['indian elderly couple', 'senior man india smiling', 'indian family home'],
  'रोज़ के नियम और क़ानून': ['india highway traffic', 'indian city street', 'documents signing'],
  'PMEGP': ['indian factory worker', 'small business india', 'indian workshop'],
  'MSME / Udyam': ['indian small business', 'indian factory', 'indian shopkeeper'],
  'राज्य की स्वरोजगार योजनाएँ': ['indian street vendor', 'indian woman tailoring', 'small business india'],
  'CGTMSE: बिना गारंटी लोन': ['indian businessman', 'bank loan meeting', 'indian factory'],
  'मुद्रा लोन': ['indian shopkeeper', 'indian street food vendor', 'indian woman entrepreneur'],
};
const FALLBACK = ['indian city street', 'indian rupee notes', 'indian people walking'];

const hash = s => [...String(s)].reduce((h, c) => Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0, 2166136261);

async function search(q, key) {
  const u = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=20`;
  const r = await fetch(u, { headers: { Authorization: key } });
  if (!r.ok) throw new Error(`pexels ${r.status} for "${q}"`);
  return (await r.json()).videos || [];
}

// Best portrait file: at least 1280 tall, as close to 1920 as possible (smaller downloads, enough detail).
function pickFile(v) {
  const files = (v.video_files || []).filter(f => f.height > f.width && /mp4/.test(f.file_type || 'mp4') && f.height >= 1280);
  files.sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920));
  return files[0];
}

module.exports = async function footage(spec, dir) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const n = spec.scenes.length;
  let qs = spec.broll ? [].concat(spec.broll) : (DEFAULTS[spec.playlist] || FALLBACK);
  const used = new Set(), clips = [];
  fs.mkdirSync(dir, { recursive: true });
  const cache = {};
  for (let i = 0; i < n; i++) {
    // Audience is Indian: every search names India so the people on screen look like the viewer.
    const q = /india/i.test(qs[i % qs.length]) ? qs[i % qs.length] : `indian ${qs[i % qs.length]}`;
    cache[q] = cache[q] || (await search(q, key)).filter(v => v.duration >= 4 && pickFile(v));
    const pool = cache[q].filter(v => !used.has(v.id));
    if (!pool.length) { clips.push(clips[clips.length - 1] || null); continue; }
    const v = pool[hash(spec.id + i) % Math.min(pool.length, 8)];
    used.add(v.id);
    const f = pickFile(v), dst = path.join(dir, `clip-${i}.mp4`);
    const r = await fetch(f.link);
    if (!r.ok) throw new Error(`download ${r.status} ${f.link}`);
    fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
    clips.push({ file: dst, credit: `${v.user && v.user.name} (pexels.com/video/${v.id})` });
  }
  return clips.every(Boolean) ? clips : null;
};
