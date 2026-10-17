// Weekly YouTube report: turns the Make "weekly report" response into a short Markdown table.
// Usage: node report.js reports/<date>.json > reports/<date>.md
const fs = require('fs');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const vids = (r.videos.items || []).map(v => ({
  title: v.snippet.title.replace(/\s*#shorts/i, '').replace(/\|/g, '/'),
  date: (v.status.publishAt || v.snippet.publishedAt).slice(0, 10),
  status: v.status.privacyStatus,
  views: +(v.statistics.viewCount || 0), likes: +(v.statistics.likeCount || 0), comments: +(v.statistics.commentCount || 0),
  id: v.id,
})).filter(v => v.status === 'public').sort((a, b) => b.views - a.views);
const sum = k => vids.reduce((s, v) => s + v[k], 0);
const out = [`# YouTube report ${process.argv[2].match(/\d{4}-\d{2}-\d{2}/)[0]}`, '',
  `Public videos: ${vids.length} · views ${sum('views')} · likes ${sum('likes')} · comments ${sum('comments')}`, '',
  '| # | Video | Date | Views | Likes | Comments |', '|---|---|---|---|---|---|',
  ...vids.map((v, i) => `| ${i + 1} | [${v.title}](https://youtube.com/shorts/${v.id}) | ${v.date} | ${v.views} | ${v.likes} | ${v.comments} |`),
  '', '## Playlists', '',
  ...(r.playlists.items || []).map(p => `- ${p.snippet.title}: \`${p.id}\` (${p.contentDetails.itemCount} videos)`)];
console.log(out.join('\n'));
