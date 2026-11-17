# LinkedIn auto-post (Parachar company page)

What runs automatically: one post Mon-Sat at 08:43 IST from `linkedin/queue/<YYYY-MM-DD>-<slug>.json`
(text, optional image or PDF carousel from `linkedin/media/`, optional first comment), posted AS the Parachar
company page. After posting the file moves to `linkedin/published/`. Files with `"needs_owner"` are skipped.

Owner rule (17 Nov 2026): posts go only to the company page, never the personal profile. If repo variable
`LI_ORG` is not set, the workflow posts nothing and keeps the queue.

What is NOT automated (on purpose, LinkedIn bans bots): connection requests, DMs, comments on other people's posts.

Note: this repo is public, so queued drafts are visible to anyone who opens the repo.

## One-time setup for the company page (owner)
Posting as a page needs LinkedIn's **Community Management API** (free, but LinkedIn reviews the request).
LinkedIn allows that product only on an app with no other products, so make a NEW app:
1. https://www.linkedin.com/developers/apps/new → App name: Parachar Page Poster, LinkedIn Page: Parachar,
   logo-400x400.png → Create.
2. App → **Settings** → **Verify** next to the Parachar page → open the link as a page admin → Verify.
3. App → **Products** → **Community Management API** → Request access → fill the form (use case: "Scheduling
   our own company page posts"). Wait for LinkedIn's approval email.
4. After approval: https://www.linkedin.com/developers/tools/oauth/token-generator → pick this app → tick
   `w_organization_social` and `r_organization_social` → Request access token → copy it.
5. GitHub repo → Settings → Secrets and variables → Actions:
   - Secret `LI_TOKEN` = the new token. Variable `LI_TOKEN_DATE` = today (YYYY-MM-DD).
   - Variable `LI_ORG` = the page number from the page admin URL `linkedin.com/company/<number>/admin/`.
   - Variable `LI_AUTO_POST` = `on`.
6. Actions → **LinkedIn post** → Run workflow (dry run ticked) → the log must show `urn:li:organization:<number>`.

## Every 60 days
LinkedIn tokens for this product last 60 days and can't auto-refresh. From day 50 the run shows a warning; at day 60
it fails and GitHub emails you. Repeat step 3, update `LI_TOKEN` and `LI_TOKEN_DATE`. 2 minutes.

## Spec format
```json
{ "id": "slug", "text": "post text", "first_comment": "link goes here",
  "media": { "type": "document|image", "file": "name.pdf", "title": "Carousel title" },
  "needs_owner": "what is missing (remove to allow posting)" }
```

## Drafts waiting for the owner
`linkedin/drafts/` holds posts that need something only the owner has (a Search Console screenshot, a real ads
example, a video). They are out of the queue so no posting day is left empty. When the input is ready, fill it in,
remove `needs_owner`, and move the file into `queue/` with a free Mon/Tue/Thu/Sat date.
