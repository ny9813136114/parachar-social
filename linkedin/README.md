# LinkedIn auto-post (owner's personal profile)

What runs automatically: one post on Mon/Tue/Thu/Sat at 08:45 IST from `linkedin/queue/<YYYY-MM-DD>-<slug>.json`
(text, optional image or PDF carousel from `linkedin/media/`, optional first comment with the link). After posting
the file moves to `linkedin/published/`. Files with `"needs_owner"` are skipped until that field is removed.

What is NOT automated (on purpose, LinkedIn bans bots): connection requests, DMs, comments on other people's posts,
company-page posts (needs LinkedIn partner approval; repost personal posts to the page by hand).

Note: this repo is public, so queued drafts are visible to anyone who opens the repo.

## One-time setup (owner, ~10 min)
1. https://www.linkedin.com/developers/apps → **Create app**. App name: Parachar Poster. LinkedIn Page: Parachar
   (create the company page first). Logo: logo-400x400.png. Accept terms → Create.
2. App → **Products** → request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect** (both instant).
3. App → **Auth** tab → under OAuth 2.0 tools click **OAuth Token Generator Tool** (or open
   https://www.linkedin.com/developers/tools/oauth/token-generator) → pick the app → tick `openid`, `profile`,
   `w_member_social` → Request access token → sign in → copy the token.
4. GitHub repo → Settings → Secrets and variables → Actions:
   - Secret `LI_TOKEN` = the token
   - Variable `LI_TOKEN_DATE` = today's date (YYYY-MM-DD)
   - Variable `LI_AUTO_POST` = `on` (set to `off` any time to pause)
5. Actions → **LinkedIn post** → Run workflow → leave "dry run" ticked → check the log. Then run once with a real date.

## Every 60 days
LinkedIn tokens for this product last 60 days and can't auto-refresh. From day 50 the run shows a warning; at day 60
it fails and GitHub emails you. Repeat step 3, update `LI_TOKEN` and `LI_TOKEN_DATE`. 2 minutes.

## Spec format
```json
{ "id": "slug", "text": "post text", "first_comment": "link goes here",
  "media": { "type": "document|image", "file": "name.pdf", "title": "Carousel title" },
  "needs_owner": "what is missing (remove to allow posting)" }
```
