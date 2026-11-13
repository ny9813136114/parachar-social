# Parachar services content (Instagram / Facebook / LinkedIn)

From 12 Nov 2026 the owner moved Instagram (+ Facebook copy) and LinkedIn to **services** content (audits,
automation, SEO, AI search, ads) for businesses of every size and industry. YouTube stays the Hindi tools channel.
Plan files live in the project folder `services-linkedin-blueprint-2026-11-12/` (MASTER-PLAN.md, CONTENT-SYSTEM-ALL-INDUSTRIES.md).

- `social/ig/queue/<YYYY-MM-DD>-<slug>.json`: one reel spec per file, `"style": "services"` → `engine-services.html`
  (navy/teal look, Hinglish, captions always burned in, IG safe zones). Extra fields: `series`, `industry`, `caption`
  (Instagram caption with keyword CTA: AUDIT / AI / CALC / LEAK).
- Render: `MUSIC=on TTS_ENGINE=edge node render.js social/ig/queue/<file>.json` → `out/<id>/<id>.mp4`, `cover.png`, `post.md`.
- Posting to Instagram/Facebook is NOT wired yet (needs the owner's OK); LinkedIn posting is in `linkedin/`.
