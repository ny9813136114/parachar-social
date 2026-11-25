// LinkedIn page comments through the Make scenario's "api" route (same LinkedIn connection that posts).
// Usage: MAKE_LI_HOOK=... node li-comments.js list            -> writes inbox.json (comments on our posts, last 45 days)
//        MAKE_LI_HOOK=... node li-comments.js reply <postUrn> <parentCommentUrn> <text>   -> replies as the Parachar page
// Only ids, text and time are kept; no names or profile data.
const fs = require('fs'), path = require('path');
const HOOK = (process.env.MAKE_LI_HOOK || '').trim();
const ORG = `urn:li:organization:${process.env.LI_ORG || '143949677'}`;
const enc = encodeURIComponent;

async function api(method, url, body) {
  const r = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'api', api_method: method, api_url: url, api_body: body ? JSON.stringify(body) : '' }) });
  const t = await r.text();
  if (process.env.LI_DEBUG) console.log("raw:", t.slice(0, 500));
  let j; try { j = JSON.parse(t); } catch { throw new Error(`Make answered ${r.status}: ${t.slice(0, 300)}`); }
  if ("error" in j) throw new Error(`LinkedIn: ${JSON.stringify(j.error).slice(0, 400)}`);
  if (j.status && j.status >= 300) throw new Error(`LinkedIn ${j.status}: ${JSON.stringify(j.body).slice(0, 300)}`);
  return j.body;
}

async function list() {
  const dir = path.join(__dirname, 'linkedin', 'published');
  const posts = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => ({ f, p: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).posted }))
    .filter(x => x.p && x.p.urn && Date.now() - Date.parse(x.p.at) < 45 * 864e5);
  const out = [];
  for (const { f, p } of posts) {
    let b;
    try { b = await api('GET', `/rest/socialActions/${enc(p.urn)}/comments?count=50`); }
    catch (e) { out.push({ post: p.urn, file: f, error: e.message }); continue; }
    if (process.env.LI_DEBUG) console.log(f, p.urn, String(JSON.stringify(b)).slice(0, 600));
    const els = (b && b.elements) || [];
    const byOrg = new Set(els.filter(c => c.actor === ORG && c.parentComment).map(c => c.parentComment));
    for (const c of els) {
      if (c.actor === ORG) continue;
      const urn = c['$URN'] || c.commentUrn || `urn:li:comment:(${p.urn},${c.id})`;
      out.push({ post: p.urn, file: f, comment: urn, text: c.message && c.message.text, at: c.created && new Date(c.created.time).toISOString(),
        replied: byOrg.has(urn) || !!(c.commentsSummary && c.commentsSummary.aggregatedTotalComments) });
    }
  }
  fs.writeFileSync('inbox.json', JSON.stringify({ checked: new Date().toISOString(), posts: posts.length, comments: out }, null, 1) + '\n');
  console.log(`${posts.length} posts, ${out.filter(x => x.comment).length} comments, ${out.filter(x => x.comment && !x.replied).length} without our reply`);
}

async function reply(post, parent, text) {
  if (!post || !parent || !text) throw new Error('reply needs <postUrn> <parentCommentUrn> <text>');
  const b = await api('POST', `/rest/socialActions/${enc(parent)}/comments`, { actor: ORG, object: post, parentComment: parent, message: { text } });
  console.log('replied', JSON.stringify(b).slice(0, 200));
}

(async () => {
  if (!HOOK) throw new Error('MAKE_LI_HOOK not set');
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'list') return list();
  if (cmd === 'reply') return reply(...a);
  throw new Error('usage: node li-comments.js list | reply <post> <parent> <text>');
})().catch(e => { console.error(`::error::${e.message}`); process.exit(1); });
