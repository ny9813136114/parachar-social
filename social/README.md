# Parachar services content (Instagram / Facebook / LinkedIn)

From 12 Nov 2026 the owner moved Instagram (+ Facebook copy) and LinkedIn to **services** content (audits,
automation, SEO, AI search, ads) for businesses of every size and industry. YouTube stays the Hindi tools channel.
Plan files live in the project folder `services-linkedin-blueprint-2026-11-12/` (MASTER-PLAN.md, CONTENT-SYSTEM-ALL-INDUSTRIES.md).

- `social/ig/queue/<YYYY-MM-DD>-<slug>.json`: one reel spec per file, `"style": "services"` → `engine-services.html`
  (navy/teal look, Hinglish, captions always burned in, IG safe zones). Extra fields: `series`, `industry`, `caption`
  (Instagram caption with keyword CTA: AUDIT / AI / CALC / LEAK).
- Render: `MUSIC=on TTS_ENGINE=edge node render.js social/ig/queue/<file>.json` → `out/<id>/<id>.mp4`, `cover.png`, `post.md`.
- Carousels: `social/ig/queue/<date>-<slug>.json` with `"type": "carousel"` and a `caption`; slides are PNGs in
  `social/ig/media/<id>/slide-N.png` (2-10, 1080x1350). Build new ones with `node carousel.js <spec.json>` from a
  `slides` list (cover / point / cta); add `"pdf"` to also write a LinkedIn PDF.
- Posting (owner OK 13 Nov 2026): `.github/workflows/ig-post.yml`, Mon-Sat 09:00 IST, posts today's file with `ig.js`:
  reels are rendered in the run, uploaded to release `ig-<id>`, then posted as a Reel; carousels post from the raw
  PNG URLs. A Facebook Page copy follows (best effort). Posted files move to `social/ig/published/` (+ `log.json`).
  Pause: repo variable `IG_AUTO_POST` = `off`. No Facebook copy: `FB_COPY` = `off`. Wednesday is the owner's face
  reel, posted by hand. Manual test: Actions → Instagram post → Run workflow (dry run ticked = nothing is posted).
- LinkedIn posting is in `linkedin/`.
