# Parachar social media: video design + automation plan (11 Oct 2026)

Goal: YouTube, Instagram aur Facebook par har hafte videos jaayein, bina Nishant ke banaye.
Claude videos banata hai (cloud mein), Nishant ka kaam sirf hafte mein ~10 minute: upload/schedule (ya baad mein woh bhi automatic).

Samples (abhi dekh lo): `video-engine/out/pmegp-10-lakh/pmegp-10-lakh.mp4` (27 s) aur `video-engine/out/udyam-free-myth/udyam-free-myth.mp4` (18 s).

---

## 1. Video design (UI/UX of videos)

### Hamara viewer kaun hai
- Chhota business owner / naya udyami, 22-50 saal, Hindi belt, sasta Android phone, Jio data.
- Feed mein scroll kar raha hai, **aawaz band** (FB/IG par zyada tar videos mute mein dekhe jaate hain).
- Ek hi sawaal: "Mujhe kitna paisa milega, aur kaise?" Bharosa kam hai, kyunki scam bahut hain.

### Design principles (har video mein)
1. **Mute mein bhi poori baat samajh aaye.** Screen ka text hi script hai. Voice bonus hai, zaroori nahi.
2. **Pehle 1.5 second mein ₹ number.** Hook = jo log search karte hain + ek bada ₹ amount, amber colour mein.
3. **Ek screen, ek baat.** Har scene 3-6 second, max ~12 shabd.
4. **Har video ek "hisaab" hai.** Hamari signature: white calculator card, inputs ek-ek karke aate hain, phir ₹ number count-up hota hai. Yahi Parachar ki pehchaan banegi (log isse pehchaanenge, jaise web stories ka look).
5. **Bharosa dikhe.** Har frame par neeche: source + "जाँच: <date>" + "यह अनुमान है, मंज़ूरी नहीं". Scam warning card (agent ko paise mat do) jahan relevant ho.
6. **Ek hi CTA.** Last scene: phone mockup, parachar.com, tool ka naam, "लिंक डिस्क्रिप्शन / बायो में".
7. **Safe zones.** 1080x1920. Text sirf x 64-952, y 200-1500 mein, taaki YouTube/Instagram ke buttons aur caption ke neeche kuch na chhupe.

### Brand system (web stories jaisa hi, taaki sab ek jaisa dikhe)
| Cheez | Value |
|---|---|
| Size | 1080x1920 vertical, 30 fps, 15-35 second |
| Font | Mukta (Hindi + English dono), 800 headlines, 500 body |
| Colours | Teal #0F766E (calculator videos), Navy #1F4E79 (news / myth videos), Amber #F59E0B sirf ₹ aur highlight ke liye, Red/Green sirf galat/sahi ke liye |
| Text size | Headline 94 px, numbers 190 px, body 42-48 px (phone par bina zoom padh sakein) |
| Logo | Top-left chip: logo + parachar.com, poore video mein |
| Motion | Halka: upar slide + fade (0.45 s), number count-up (1.4 s), button pulse. Koi jhatke wale transitions nahi |
| Language | Screen par Hindi (Devanagari), scheme names English mein (PMEGP, Udyam). Title Hindi + English keywords dono |

### 5 video templates (sab ek engine se bante hain)
| # | Template | Kab use karein | Scenes |
|---|---|---|---|
| T1 | **Kitna milega?** (calculator) | Har calculator ke liye, sabse zyada | hook → inputs card → ₹ count-up → paisa kahan se (bar) → warning → CTA |
| T2 | **Myth vs Sach** | Scam, galat jaankari (Udyam fees, agent, "guarantee approval") | hook → मिथक card + "गलत" stamp → सच card → pehchaan list → CTA |
| T3 | **Kya badla** (news) | Scheme update, deadline, naya rule (Discover posts ke saath) | hook → purana vs naya → kis par asar → CTA |
| T4 | **Kaun sa better?** | PMEGP vs state scheme, Mudra vs SVANidhi | hook → 2 cards side by side → winner ₹ → CTA |
| T5 | **3 cheezein / checklist** | Documents, rejection ke kaaran, steps | hook → numbered list → CTA |

T1 aur T2 engine mein ready hain (samples dekho). T3-T5 same parts (hook, card, list, split, cta) se banenge; jab pehli baar zaroorat hogi tab add karunga.

### Hook formulas (title aur pehli screen)
- "₹X ke business par sarkar degi ₹Y" (T1)
- "Mahila ho? Sirf 5% lagao" (audience call-out)
- "Bank collateral maang raha hai? Ruko." (problem)
- "<Kaam> ke ₹1,500 maange gaye?" (scam, T2)
- "1 April se badal gaya: ..." (news, T3)
- "PMEGP ya <state scheme>: kisme zyada paisa?" (T4)

---

## 2. Platform plan

| Platform | Kya daalenge | Kitna | Kyun |
|---|---|---|---|
| **YouTube Shorts** | Har video | 5/hafta | Search se milta hai (log YouTube par "PMEGP subsidy kitni milegi" search karte hain). Description + pinned comment mein tool link |
| **YouTube long** (baad mein) | 3-5 min "slideshow explainer", same engine se, chapters ke saath | 1/15 din, mahine 2 se | Long videos search mein saalon tak traffic dete hain |
| **Instagram Reels** | Same video | 5/hafta | Reach + share. Bio link = tools page. Reel par trending/halki music in-app lagao, reach badhti hai |
| **Facebook Page Reels** | Same video, Meta Business Suite se IG ke saath ek click mein | 5/hafta | Facebook par 35+ age ke business owners zyada hain; MSME groups mein share bhi |
| **WhatsApp Channel** (free) | Video + 2 line + link | 3/hafta | Share-kit already hai; channel se repeat audience banti hai |

**Weekly mix (5 videos):** 3x T1 calculator, 1x T2 myth/scam, 1x T3/T4 (news ya comparison). Schedule: Mon, Tue, Thu, Fri, Sat, shaam 7-8 baje.
**Kaunse tools pehle:** PMEGP, Mudra, CGTMSE, SVANidhi, Udyam, phir state schemes (Maharashtra CMEGP, UP, Bihar, MP, Rajasthan) jahan Hindi search zyada hai. Har state video state ke Facebook groups mein share hoga.

**Har video ke saath (engine khud banata hai, `post.md`):** title, description, hashtags, pinned comment, alag UTM link har platform ke liye (`utm_source=youtube|instagram|facebook`), aur `captions.srt` (YouTube par upload karne se search mein madad).

**Measure (har Monday):** views, average watch %, link clicks (GA4 mein utm_source), comments mein sawaal. Jo sawaal aaye, wahi agle hafte ka video.

---

## 3. Automation pipeline

```
Calculator rules (already tested, official source + date)
        │  Claude har hafte 5 video JSON likhta hai (numbers tool ke maths se, AI se nahi)
        ▼
video-engine (HTML animation → Chromium → ffmpeg)   ← cloud mein, Nishant ka 0 minute
        │  har video: MP4 + cover.png + captions.srt + post.md
        ▼
social-media/weekly/<date>/   (shared project files)
        │
        ├─ Phase 1 (abhi, free): Nishant phone se 10 min/hafta schedule karta hai
        │     YouTube Studio app → upload → schedule
        │     Meta Business Suite app → ek baar mein Instagram + Facebook dono schedule
        │
        └─ Phase 2 (accounts ban jaane ke baad): fully automatic
              Google Drive folder → Make.com scenario → YouTube upload + Instagram/Facebook Reels publish
              (Make.com Claude ke saath kaam karta hai; Nishant ke YouTube/Meta login ek baar chahiye)
```

### Kya automatic hai, kya nahi
| Step | Kaun | Time |
|---|---|---|
| Topic chunna (search data + comments se) | Claude | 0 |
| Script + numbers check | Claude (tool ke tests se) | 0 |
| Video, cover, captions, title, description | Claude (engine) | 0 |
| Upload + schedule | Phase 1: Nishant (10 min/hafta). Phase 2: Make.com | 10 min → 0 |
| Comments ka jawab | Claude drafts deta hai, Nishant copy-paste (optional) | 5 min |

### Voice-over (optional, Nishant ka faisla)
Videos mute-first design hain, toh bina voice bhi chalenge. Voice se YouTube par watch time badhta hai. 3 options:
1. **Bina voice** + platform ki music (free, abhi yahi default).
2. **AI Hindi voice** (Sarvam AI Bulbul ya Google Cloud TTS, ~₹0-200/mahina is volume par). Har scene ka `say` text already JSON mein hai, engine captions bhi bana deta hai. API key chahiye.
3. **Nishant ki apni aawaz**: hafte mein ek baar 5 lines phone par record. Sabse zyada bharosa, par time lagta hai.

---

## 4. Nishant ko ek baar karna hai (accounts sirf aap bana sakte ho)
1. YouTube channel "Parachar" (apne Google account se), profile = `brand/parachar-icon/avatar-1024-white.png`.
2. Facebook Page "Parachar" + Instagram **Professional** account, dono Meta Business Suite mein link.
3. Bio link: `https://parachar.com/?utm_source=instagram&utm_medium=bio`.
Uske baad bas har hafte `social-media/weekly/<date>/` folder se schedule karna hai.

## 5. Next steps (Claude)
- Har Monday 5 videos ka batch (routine), pehla batch: PMEGP women, CGTMSE ₹25 lakh, Mudra Tarun Plus, SVANidhi 2.0 (news), Maharashtra CMEGP vs PMEGP.
- T3, T4 templates engine mein add.
- Channel banner + profile images (YouTube 2560x1440, FB cover 1640x624) same brand mein.
- Phase 2 Make.com scenario, jab accounts ban jaayein aur Nishant haan bole.
