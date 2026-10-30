# Meta Graph API, app setup, audience stats, and what automation is allowed

**Research date: 2026-10-29.** Sources are official Meta pages; every claim below is either quoted
by effect from those pages or marked UNVERIFIED. This is engineering guidance, not legal advice.

**Official sources**
- Page Insights reference: <https://developers.facebook.com/docs/graph-api/reference/page/insights/>
- Platform Terms: <https://developers.facebook.com/terms/>
- Developer Policies: <https://developers.facebook.com/devpolicy/>
- Automated Data Collection Terms: <https://developers.facebook.com/documentation/development/terms-and-policies/automated-data-collection>
- Pages API: <https://developers.facebook.com/documentation/pages-api/posts>
- Graph Explorer / Token Debugger: <https://developers.facebook.com/tools/explorer> · <https://developers.facebook.com/tools/debug/accesstoken/>

---

## 1. The exact click path (what to do, in order)

### A. Create the app
1. Open <https://developers.facebook.com/apps/creation/>.
2. Use case **Other** → type **Business**.
3. Display name **PosterPal** (Meta rejects Facebook/FB/Meta/Book/Face).
4. Dashboard opens at `https://developers.facebook.com/apps/<APP_ID>/dashboard/`.
5. **Add product → Facebook Login → Settings**:
   - Client OAuth Login **ON**, Web OAuth Login **ON**
   - Valid OAuth Redirect URIs: `http://127.0.0.1:8080/api/facebook/callback` (Windows desk)
     and/or `https://<your-host>/api/facebook/callback` (Docker) — exact match, no trailing slash
   - Settings → Basic → **App Domains**: hostname only; leave empty for `127.0.0.1`
6. **App roles** (`/roles`): confirm your account is Admin. Keep **Development Mode**; role users can
   grant `pages_*` without App Review.
7. **Settings → Basic**: copy **App ID**; **Show** App Secret. Paste both in PosterPal → Settings.
   Never paste the secret into chat or commit it.

Useful dashboard links (replace `<APP_ID>`):
| Purpose | URL |
|---|---|
| Apps list | `https://developers.facebook.com/apps/` |
| Basic settings | `https://developers.facebook.com/apps/<APP_ID>/settings/basic/` |
| Advanced settings | `https://developers.facebook.com/apps/<APP_ID>/settings/advanced/` |
| App roles | `https://developers.facebook.com/apps/<APP_ID>/roles/` |
| App Review | `https://developers.facebook.com/apps/<APP_ID>/app-review/` |
| Alerts | `https://developers.facebook.com/apps/<APP_ID>/alerts/` |
| Privacy policy field | Basic settings → Privacy Policy URL (required for public apps) |

### B. Business portfolio (optional for a personal desk, required for Shops)
1. <https://business.facebook.com/settings> → **Accounts → Pages** → add your Pages to the portfolio.
2. **Users → People** → give your account full control.
3. **Accounts → Apps** — the app appears once you own it as Admin; business verification is only
   needed for advanced access / Shops / some ad features.
4. Commerce Manager: <https://business.facebook.com/commerce> (catalog + shop + checkout URL).

### C. Connect in PosterPal
1. Settings → paste App ID + App Secret → save.
2. Connect → official OAuth popup → approve the `pages_*` scopes.
3. PosterPal exchanges the code server-side, extends the token, calls `GET /me/accounts`, imports
   every Page granting `CREATE_CONTENT`, and stores tokens AES-GCM encrypted.
4. Re-auth (Graph 190) → Settings → Reconnect. A token can die from a password change or
   deauthorisation; the vault marks it invalid instead of failing silently.

### D. Messenger (if you want DMs)
1. App → **Messenger → Settings → Webhooks → Add Callback URL**:
   `https://<host>/api/facebook/messenger` + the verify token you saved in PosterPal → `/messenger`.
2. Subscribe to `messages`, `messaging_postbacks`; select the Page.
3. `pages_messaging` App Review is required before anyone who is not an app role can DM the Page.

### E. Shops (optional)
Fourthwall → Apps → Instagram & Facebook Shop → connect catalog → Meta asks for a **checkout URL**;
paste Fourthwall's. Meta holds the catalog/order routing; Fourthwall hosts checkout (Merchant of
Record). Full steps: [COMMERCE-FOURTHWALL.md](COMMERCE-FOURTHWALL.md) §4.

---

## 2. Audience / stats: what PosterPal can actually link

### Available through Graph (verified on the Page Insights page)

Requirements for `GET /{page-id}/insights`:
- Page access token from someone with the **ANALYZE** task on the Page
- Permissions **`read_insights`** + **`pages_read_engagement`**
- Data only for Pages with **100+ likes**; most metrics update **once/24 h**; only **2 years**
  of history; max **90 days** per `since`/`until` window
- Demographic metrics (age/gender/location) only come back if **100+ people** are in that slice
- Several metrics are **deprecated by June 15, 2026**; an invalid metric makes the whole request
  error, so PosterPal fetches views separately with a fallback metric list
  (`src/lib/posterpal/insights.ts`)

Examples PosterPal can surface: `page_post_engagements`, `page_impressions*`,
`page_fans_country`, `page_fans_city`, `page_fans_locale`, `page_fan_adds*`, `page_views_total`,
`page_video_views*`, `page_media_view`, and post-level `post_media_view`,
`post_total_media_view`, `post_reactions_*`, `post_clicks*`. The desk currently syncs reactions,
comments, shares, and post media views (see `src/lib/posterpal/sync.ts` + the Analytics tab).

### **Personal-profile audience stats are NOT exposed to apps**
There is no Graph endpoint that returns *your profile's* audience insights (followers by
demographics, profile reach). Meta keeps profile analytics inside **Meta Business Suite /
Professional Dashboard** for the account owner. UNVERIFIED whether any partner API exists; do not
build against one.

**Practical options for profile stats:**
1. **Manual export/reference:** Business Suite → Insights → download CSV and keep it outside the
   desk. PosterPal does not ingest personal-profile analytics.
2. **Move the audience to a Page:** Pages are the API-supported surface; pages get insights,
   publish, Messenger, and Shops. This is the reason the business plan runs Pages, not profiles.
3. **Instagram (business/creator account):** separate permissions (`instagram_basic`,
   `instagram_manage_insights`, `instagram_content_publish`) and separate App Review; not built yet.

---

## 3. Is driving Chrome to set up/hook my Facebook a ToS violation?

**Short answer: yes, treat it as prohibited. Don't do it.** Do the 10-minute setup by hand; use the
API for data afterwards.

Why (official basis):

1. **The Platform Terms license covers the Platform APIs, not the website.**
   Meta Platform Terms §2.a grant a limited licence to "use, access, and integrate with Platform"
   only as permitted, and forbid using/accessing Platform "in any way" beyond that licence.
   `Platform` is defined as the APIs/SDKs/tools — not facebook.com's UI.
2. **Automated access/collection is explicitly restricted.** Meta's Automated Data Collection Terms
   govern automated collection of data from Meta products; the Developer Policies separately ban
   unofficial access and scraping. Driving a logged-in browser to click through the developer
   dashboard is automated access to a Meta product outside the API.
3. **It is not an API-exposed action anyway.** Creating/configuring an app, adding redirect URIs,
   adding app roles, and linking a business portfolio are dashboard-only. The ONLY compliant way to
   perform them is a human in the Meta UI — which is why every guide (including this repo's) ends
   with "the operator clicks Connect".
4. **Account risk is real and asymmetric.** Automated UI sessions can trigger checkpoint/2FA/CAPTCHA
   and account or app enforcement; you would lose the credential that runs the whole business to
   save ten minutes. Nothing in PosterPal needs it: `Connect` is a human click by design.

**What IS allowed (and what PosterPal does):**
- OAuth via the official dialog, server-side code exchange, `appsecret_proof` on every Graph call.
- Reading/writing Pages and posts through documented Graph endpoints.
- Human-in-the-loop actions; AI drafting that a human reviews and sends.
- Token management (extension, debugger) through official endpoints.

**Not allowed:** scraping facebook.com, cookie/session copying, Selenium/Playwright against
facebook.com, auto-like/comment/follow/share/DM, Group spam, buying engagement, "AI posts while you
sleep" unsupervised. Meta may audit and suspend; enforcement is automated and manual.

**AI-specific:** Meta does not ban AI-written captions or AI images. It bans inauthentic behaviour,
undisclosed manipulation (AI still presented as a real documentary photo), and automated engagement.
PosterPal flags AI media (`createdWithAi`), keeps Publish/Send human, and refuses auto-engagement
briefs.

---

## 4. Setup checklist (copy/paste order)

1. Create app → name **PosterPal** → add **Facebook Login**.
2. Redirect URI exactly `http://127.0.0.1:8080/api/facebook/callback` (or HTTPS host variant).
3. App roles: your account Admin; keep Development Mode.
4. Copy App ID + App Secret → PosterPal **Settings** → save.
5. PosterPal **Connect** → approve `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`,
   `pages_manage_metadata`, `read_insights`, `publish_video`.
6. Verify import: rail lists your real Pages (not just practice).
7. Publish one test post manually; check Graph Explorer for the post id if it fails.
8. Analytics tab → **Sync** → confirm reactions/comments/views appear (needs 100+ likes for
   Page-level insights).
9. Messenger: save verify token → callback URL → subscribe fields → test from a personal account.
10. Optional: Business portfolio + Commerce Manager + Fourthwall Meta app for a Shop tab.

## 5. Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| `URL Blocked: This redirect failed` | URI mismatch (`localhost` vs `127.0.0.1`, trailing slash, http vs https) | Make the Meta URI byte-identical to the desk's Settings value |
| `App not active` / `app is in development mode` | You are not an app role | Add the account as Admin/Developer/Tester |
| Empty `/me/accounts` | No Page admin rights, or no `pages_show_list` granted | Reconnect; check Page roles on facebook.com |
| Graph 190 | Token expired/revoked/password changed | Vault marks invalid → Reconnect |
| Graph 100 invalid metric | Deprecated insight metric | Desk retries the narrower metric; update `insights.ts` |
| Graph 4 / 17 / 32 / 613 / 80001 | Rate limit / BUC throttle | Desk backs off with jitter; check Vault quota chip |
| Graph 368 | Temporarily blocked for policy | Stop, review content; wait — do not retry in a loop |
| Insights empty but posts exist | Page <100 likes | Nothing to fix — API limitation |
| Messenger verify fails | Verify token mismatch or no URL saved | Save token in `/messenger` first, paste identical value in Meta |
| Media images 401 | Auth enabled and no session cookie | Sign in to the desk in the same browser |

## 6. Where this lives in the code

| Concern | File |
|---|---|
| OAuth start/callback, token extension, Page import | `src/lib/posterpal/facebook-oauth.ts`, `routes/api/facebook/{start,callback}.ts` |
| Graph client + `appsecret_proof` + error mapping | `src/lib/posterpal/graph.ts` |
| Insight sync (with metric fallback) | `src/lib/posterpal/sync.ts`, `src/lib/posterpal/insights.ts` |
| Official docs list (shown in Connect coach / Agent) | `src/lib/posterpal/facebook-docs.ts`, `meta-setup.ts` |
| Messenger webhook + 24 h window | `src/lib/posterpal/messenger.ts`, `routes/api/facebook/messenger.ts` |
| Commerce/Shops | `docs/COMMERCE-FOURTHWALL.md`, `src/lib/commerce/*` |
