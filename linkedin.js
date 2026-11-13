// LinkedIn auto-post for the owner's PERSONAL profile (Share on LinkedIn, w_member_social).
// Usage: node linkedin.js post [YYYY-MM-DD]   -> posts linkedin/queue/<date>-*.json, moves it to linkedin/published/
//        node linkedin.js check               -> verifies the token and prints the author URN
// Env: LI_TOKEN (secret, 60-day token from LinkedIn's OAuth token generator), LI_VERSION (YYYYMM, optional),
//      LI_TOKEN_DATE (YYYY-MM-DD the token was made; warns after 50 days), DRY_RUN=1 to only print.
// No connection requests, DMs or comments on other people's posts: those stay manual (LinkedIn bans bots).
const fs = require('fs'), path = require('path');
const TOKEN = process.env.LI_TOKEN, VER = process.env.LI_VERSION || '202509', DRY = process.env.DRY_RUN === '1';
const API = 'https://api.linkedin.com';
const H = (extra = {}) => ({ Authorization: `Bearer ${TOKEN}`, 'LinkedIn-Version': VER, 'X-Restli-Protocol-Version': '2.0.0', ...extra });

async function req(method, url, body, headers = {}) {
  const r = await fetch(url, { method, headers: H(headers), body });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${t.slice(0, 500)}`);
  return { r, json: t ? (() => { try { return JSON.parse(t); } catch { return t; } })() : null };
}
async function me() { const { json } = await req('GET', `${API}/v2/userinfo`); return `urn:li:person:${json.sub}`; }

async function upload(kind, author, file) { // kind: images | documents
  const { json } = await req('POST', `${API}/rest/${kind}?action=initializeUpload`,
    JSON.stringify({ initializeUploadRequest: { owner: author } }), { 'Content-Type': 'application/json' });
  const { uploadUrl } = json.value; const urn = json.value.image || json.value.document;
  const r = await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}` }, body: fs.readFileSync(file) });
  if (!r.ok) throw new Error(`upload ${file} -> ${r.status}`);
  return urn;
}
// LinkedIn "little text" format: escape reserved characters in commentary.
const esc = s => s.replace(/[\\|{}@\[\]()<>#*_~]/g, c => '\\' + c);

function tokenAgeCheck() {
  const d = process.env.LI_TOKEN_DATE; if (!d) return;
  const days = Math.floor((Date.now() - Date.parse(d)) / 864e5);
  if (days >= 60) throw new Error(`LinkedIn token is ${days} days old and has expired. Make a new one (linkedin/README.md) and update LI_TOKEN + LI_TOKEN_DATE.`);
  if (days >= 50) console.log(`::warning::LinkedIn token is ${days} days old; renew before day 60 (linkedin/README.md).`);
}

async function post(date) {
  const files = fs.readdirSync('linkedin/queue').filter(f => f.startsWith(date) && f.endsWith('.json')).sort();
  if (!files.length) { console.log(`No LinkedIn post queued for ${date}.`); return; }
  const f = files[0], spec = JSON.parse(fs.readFileSync(path.join('linkedin/queue', f), 'utf8'));
  if (spec.needs_owner) { console.log(`::warning::${f} needs the owner's input (${spec.needs_owner}); skipped.`); return; }
  tokenAgeCheck();
  const author = TOKEN ? await me() : 'urn:li:person:DRYRUN'; // read-only check, so a dry run also proves the token works
  if (DRY) console.log(TOKEN ? `Token OK (author ${author})` : '::warning::No LI_TOKEN: token not checked.');
  const body = { author, commentary: esc(spec.text.trim()), visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false };
  if (spec.media) {
    const file = path.join('linkedin/media', spec.media.file);
    if (!fs.existsSync(file)) throw new Error(`missing media ${file}`);
    const kind = spec.media.type === 'document' ? 'documents' : 'images';
    const urn = DRY ? `urn:li:${kind}:DRY` : await upload(kind, author, file);
    body.content = { media: { id: urn, title: spec.media.title || spec.id } };
  }
  if (DRY) { console.log(JSON.stringify({ file: f, body, first_comment: spec.first_comment || null }, null, 2)); return; }
  const { r } = await req('POST', `${API}/rest/posts`, JSON.stringify(body), { 'Content-Type': 'application/json' });
  const postUrn = r.headers.get('x-restli-id');
  console.log(`Posted ${f} -> ${postUrn}`);
  if (spec.first_comment) {
    await new Promise(s => setTimeout(s, 8000));
    try {
      await req('POST', `${API}/rest/socialActions/${encodeURIComponent(postUrn)}/comments`,
        JSON.stringify({ actor: author, object: postUrn, message: { text: spec.first_comment } }), { 'Content-Type': 'application/json' });
      console.log('First comment added.');
    } catch (e) { console.log(`::warning::post is live but first comment failed: ${e.message}`); }
  }
  spec.posted = { at: new Date().toISOString(), urn: postUrn };
  fs.writeFileSync(path.join('linkedin/published', f), JSON.stringify(spec, null, 2));
  fs.unlinkSync(path.join('linkedin/queue', f));
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (!TOKEN && !DRY) { console.log('::warning::LI_TOKEN secret not set; nothing posted.'); return; }
  if (cmd === 'check') { tokenAgeCheck(); console.log('Token OK, author', await me()); return; }
  if (cmd === 'post') return post(arg || new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  console.log('usage: node linkedin.js post [YYYY-MM-DD] | check');
})().catch(e => { console.error(e.message); process.exit(1); });
