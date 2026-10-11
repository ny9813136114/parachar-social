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
