# parachar-social

Parachar ke YouTube Shorts yahan GitHub Actions par bante hain. (Abhi sirf YouTube; Instagram/Facebook baad mein.)

## Kaise chalta hai
1. Claude `videos/` folder mein ek nayi `.json` file push karta hai (ek file = ek video).
2. GitHub Action **Render videos** apne aap chalta hai: Chromium mein animation chala kar ffmpeg se 1080x1920 MP4 banata hai.
3. Har run ek **Release** banata hai (repo → Releases). Usme har video ke liye: `.mp4`, cover image, `post.md` (title, description, hashtags, UTM links), `.srt` captions.
4. Phone par Releases khol kar video download karo, YouTube Studio mein upload aur schedule karo (title, description, captions `post.md` aur `.srt` se).

Saari videos dobara banani hon: Actions → Render videos → Run workflow → `all`.

## Local run
```
npm install && npx playwright install chromium   # ffmpeg bhi chahiye
node render.js videos/pmegp-10-lakh.json            # full video → out/<id>/
node render.js videos/pmegp-10-lakh.json --preview  # sirf still frames
```

## Video JSON
Scene types: `hook`, `inputs`, `count`, `split`, `warn`, `myth`, `list`, `cta`. Har scene mein `dur` (seconds) aur optional `say` (voice-over line → captions).
Text mein `*amber highlight*` chalta hai. Design rules: `SOCIAL-MEDIA-PLAN.md`.

Rules: numbers sirf tested calculator maths se; har video par source + jaanch ki date + "यह अनुमान है, मंज़ूरी नहीं".

## Roz 3 Shorts automatic (YouTube)
1. Naye video ke JSON `videos/queue/` mein daalo (naam ke order se chalte hain, jaise `2026-10-20-1-mudra.json`).
2. Har subah 6 baje (IST) `Daily YouTube Shorts` workflow queue se agle 3 video uthata hai, render karta hai, aur Make webhook (`MAKE_WEBHOOK_URL` secret) ko bhejta hai.
3. Make unhe YouTube par Private + scheduled upload karta hai: 9:00, 13:00, 19:30 IST.
4. Chhapne ke baad JSON `videos/published/` mein chala jaata hai. Rokna ho toh repo variable `AUTO_PUBLISH=off`.

### Look, voice, playlists (17 Oct 2026)
- Daily run uses the premium template (`engine-v2.html`), Madhur Hindi voice (edge-tts, each scene's `say` line) and generated background music (`music.py`). Set in `.github/workflows/daily-youtube.yml`.
- Every new spec needs `"playlist"`: one of the names in `playlists.json`. Make adds the Short to that playlist after upload.
- Monday 08:30 IST: `youtube-report.yml` saves views/likes/comments to the `reports` branch (`reports/<date>.md`).

## Engine v3: real footage, a different look per video (18 Oct 2026)

- The daily run uses `ENGINE_STYLE=v3` (engine-v3.html). Each video gets one of 7 looks (creator, akhbaar, notebook,
  tvnews, glass, poster, fintech) from its file name (date + slot), so 7 videos in a row never share a design;
  the colour palette also varies. Force one with `"look": "<name>"` in a spec.
- Backgrounds are real stock clips from Pexels (free licence, secret `PEXELS_API_KEY`), one per scene, chosen by the
  spec's `"broll"` list of English search terms (one per scene; else the playlist's defaults in bg.js). Clips get a
  slow push-in, slight hand-held sway, the look's colour grade and grain. If Pexels fails, the look's own background is used.
- `look-samples.yml` renders the next 3 queued videos to the `looks` branch for checking.
- The repo is public (free Actions minutes); keep every key in GitHub secrets, never in files.
