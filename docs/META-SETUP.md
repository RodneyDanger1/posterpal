# Meta setup for Riley Christensen — Pages, app, Messenger, and what the terms actually allow

**Sources (official only, retrieved 2026-10-29):**
[Meta Platform Terms](https://developers.facebook.com/terms/) ·
[Developer Policies](https://developers.facebook.com/devpolicy/) ·
[Automated Data Collection Terms](https://developers.facebook.com/documentation/development/terms-and-policies/automated-data-collection) ·
[Messenger Platform](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages) ·
[Pages API](https://developers.facebook.com/documentation/pages-api/posts)

> **Companion doc:** [META-GRAPH-AND-APP.md](META-GRAPH-AND-APP.md) has the exact dashboard URLs,
> audience/stats reality (Page Insights vs personal profile), the troubleshooting matrix, and the
> answer on browser automation ("don't drive Chrome through Facebook — do the 10-minute manual
> setup and use Graph for data").

## Plain-English TL;DR (what you actually click)

1. Open <https://developers.facebook.com/apps/creation/> → **Other** → **Business** → name it
   **PosterPal**.
2. In the new app: **Add product → Facebook Login → Settings** → paste
   `http://127.0.0.1:8080/api/facebook/callback` into **Valid OAuth Redirect URIs**; turn
   **Client OAuth Login** and **Web OAuth Login** on. Leave **App Domains** empty on localhost.
3. **Settings → Basic**: copy the **App ID**, click **Show** for **App Secret**.
4. In PosterPal: **Settings → Facebook app** → paste both → Save. Then **Connect** → approve the
   Pages permissions. Your Pages appear in the left rail.
5. Post one test item (Composer → Publish now). If it fails, open
   <https://developers.facebook.com/tools/debug/accesstoken/> and check the token's scopes/expiry.
6. Stats: **Analytics** tab → **Sync**. Page-level insights need **100+ Page likes**; post reactions,
   comments, shares and media views sync regardless. Your *personal profile* analytics are not
   available to any app — see [META-GRAPH-AND-APP.md](META-GRAPH-AND-APP.md) §2.
7. Messenger: PosterPal **Messenger** page → save a verify token → Meta app → **Messenger →
   Settings → Webhooks → Add Callback URL** (`https://<host>/api/facebook/messenger`) → subscribe
   `messages` + `messaging_postbacks` → select the Page.

---

## 1. Plain-English map

| Thing | What it is | Does PosterPal use it? |
|---|---|---|
| **Your Facebook account** (Riley Christensen) | The human login. Must be a real, authentic account (Platform Terms §3 / Dev Policy 1.1). | Only to grant OAuth consent |
| **Meta Business portfolio** | Container for the app + Pages + catalog/pixel. Optional for a personal desk, required for Commerce Manager / Shops. | Optional |
| **Meta app** | A credential pair (App ID + App Secret) that lets *your* server talk to Graph. Not a Page. | **Yes** — core |
| **Facebook Page** | The public identity. You must be Admin to manage it. | **Yes** — up to unlimited Pages |
| **Groups** | Community surfaces under a Page/admin. | **No API posting** — see §6 |
| **Meta Shop / Commerce Manager** | Storefront tab on Page/IG fed by a product catalog. | Only via Fourthwall's native app |
| **Messenger** | Page's direct messages. | **Yes (HITL)** |

**Rule of thumb:** a Meta app is the *door*; Pages are the *rooms*; Graph is the *corridor*.
PosterPal never logs in as you and never scrapes the site.

## 2. Create the app (10 minutes)

1. <https://developers.facebook.com/apps/creation/> → **Create app** → use case **Other** → type **Business**.
2. **Display name: `PosterPal`.** Meta rejects names containing Facebook, FB, Meta, Instagram,
   WhatsApp, **Book**, **Face** (PosterPal's `facebook-names.ts` encodes this).
3. App settings → Basic: copy **App ID**; **Show** App Secret (never paste either into chat).
4. Add product **Facebook Login** → Settings:
   - Client OAuth Login **ON**, Web OAuth Login **ON**
   - Valid OAuth Redirect URIs — exact match, one per origin:
     - `http://127.0.0.1:8080/api/facebook/callback` (Windows desk)
     - `https://<your-host>/api/facebook/callback` (Docker/HTTPS)
   - **App Domains**: hostname only (no scheme). Facebook rejects `127.0.0.1` here — leave empty
     for the local desk.
5. Keep **Development Mode**. App roles (Admin/Developer/Tester) can use every permission below
   **without App Review**. Add yourself as Admin.
6. PosterPal → **Settings** → paste App ID + App Secret → **Connect**. The desk stores the ID
   plaintext and the Secret AES-GCM-encrypted, then imports every Page from `GET /me/accounts`
   that grants `CREATE_CONTENT`.

## 3. Permissions used (and why)

| Permission | Why |
|---|---|
| `pages_show_list` | list Pages you admin |
| `pages_read_engagement` | read posts/comments already on the Page |
| `pages_manage_posts` | create/schedule posts, photos, carousels, video, reels, stories |
| `pages_manage_engagement` | reply to / hide comments |
| `pages_read_user_content` | read Page visitor comments |
| `pages_manage_metadata` | webhook subscriptions (Messenger) |
| `read_insights` | Page/post insights (needs 100+ likes for Page-level) |
| `publish_video` | video + reel publishing |
| `pages_messaging` | **Messenger** webhook + Send API (add when enabling Messenger) |

`pages_manage_posts` etc. are page-scoped and only work on Pages you actually administer with
`CREATE_CONTENT`. "Analyze-only" Pages import read-only.

## 4. Facebook Login flow PosterPal implements

```
Operator clicks Connect
  → PosterPal opens /api/facebook/start in a popup (display=popup, auth_type=rerequest)
  → facebook.com OAuth dialog (official)
  → redirect to {origin}/api/facebook/callback?code=…&state=…
  → PosterPal consumes the 15-min oauth_states row, exchanges code server-side (App Secret never leaves the server)
  → extends to a long-lived user token, stores it encrypted, imports Pages + Page tokens
  → every Graph call carries access_token + appsecret_proof = HMAC-SHA256(token, app_secret)
```

No cookie login, no Selenium, no copied session. That is exactly what Meta permits.

## 5. Messenger setup (the part with sharp edges)

1. App → **Messenger** → Settings → **Webhooks → Add Callback URL**:
   - Callback URL: `https://<host>/api/facebook/messenger` (or your LAN URL while testing)
   - Verify token: save a token in PosterPal → **Messenger** page first, then paste the same value
     into Meta. The GET handshake compares them and returns `hub.challenge`.
2. **Subscribe to fields:** `messages`, `messaging_postbacks`. Then **Add or remove Pages** and
   select the Page(s).
3. Generate a **Page access token** (or reuse the imported one). PosterPal attaches
   `appsecret_proof` to every Send API call.
4. Inbound deliveries are verified with `X-Hub-Signature-256 = sha256=` + HMAC-SHA256(raw body, App Secret)
   **before** anything is stored. Unauthentic → 401, never persisted.
5. **The 24-hour rule is enforced in code.** A reply is only allowed within 24 h of the person's
   last inbound message (up to 7 days only for a Click-to-Messenger ad thread). Outside that
   window PosterPal **refuses** rather than reaching for a Message Tag.
6. App Review: add `pages_messaging` and submit for review before anyone who isn't an app role can
   message the Page. Until then, only you (Admin/Developer/Tester) can test.

### What Messenger policies forbid (Dev Policy §5, quoted by effect)
- Messaging people who did not opt in / without a thread they started.
- Using **Message Tags or utility messages for promotions, deals, product announcements, upsells,
  donations, or polls** → use the Marketing Messages API instead (separate product; not implemented).
- Prefilling content the person did not write.
- Spam / very-high-frequency bots / facilitating inauthentic behaviour.
- Asking for payment card data inside messages; selling digital goods via messaging.
- You must keep a **Page with accurate customer-support contact info** (address + email/web/phone).

## 6. Groups — the honest answer

**There is no compliant Graph API path to post into Facebook Groups.** The old
`publish_to_groups` permission was removed, and Groups API access is limited to approved
partners for management use cases. PosterPal's own README lists "mass Group posting" as *Never*.

So for your niche-page + group strategy: **Page posts are automated; Group posts are manual.**
You can still (a) create/own the Groups, (b) pin rules and a welcome post manually,
(c) share the Page post link into the Group yourself, (d) run Messenger-connected support for
buyers. Any tool claiming automated Group posting from a personal app is either using removed
permissions or scraping — both are suspension material.

## 7. AI agents and the terms — what is actually prohibited

Meta does **not** ban AI-written captions, AI images, or an AI research assistant. What the terms
prohibit is specific:

| Prohibited | Source | PosterPal control |
|---|---|---|
| Scraping facebook.com / m.facebook.com / logged-out HTML | Automated Data Collection Terms | `research.ts` blocks facebook/instagram/threads hosts; `agentWouldRefuse` |
| Cookie login, unofficial Graph, Selenium | Platform Terms §2 | not implemented anywhere |
| Auto-like / auto-comment / auto-follow / auto-DM / auto-share | Dev Policy §1.4, §2.7 + Community Standards (inauthentic behaviour) | policy layer + agent refuse-regex; human clicks Send |
| Publishing on someone's behalf without consent | Dev Policy 1.7 | one operator, explicit click |
| Selling/licensing Platform Data; building user profiles; profiling without consent | Platform Terms §3(a) | tokens never leave the vault; no audience export |
| "AI posts while you sleep" unsupervised | inauthentic behaviour + AI disclosure expectations | every publish is a human action |
| Watermarks/CTA in Stories | Dev Policy 2.6 | Stories path has no watermark add |
| Misrepresenting AI stills as documentary photos | Community Standards on manipulated media | Agent prompt states it; media flagged `createdWithAi` |

Additional Platform-Terms obligations you now carry:
- A **public privacy policy** URL in the App Dashboard that explains what you process, why, and how
  users request deletion.
- **Delete Platform Data** on request and when no longer needed; keep tokens encrypted.
- If you ever become a **Tech Provider** (app used by other people), the Client/Tech-Provider
  sections apply (per-client data separation, written service-provider terms).
- Meta may **audit** and may suspend; enforcement is automated and manual.

**Practical stance for PosterPal:** stay in Development Mode, operator-only, secrets on your own
machine/Docker, human-in-the-loop always. That keeps you inside "app roles" and away from App
Review and most enforcement surface.

## 8. Order of operations (do this in order)

1. Create the app, add Facebook Login, set the redirect URI → paste ID/Secret in PosterPal.
2. Create/confirm each niche Page on facebook.com; add yourself as Admin.
3. PosterPal → Connect (popup) → all Pages import.
4. Compose one post per Page, local-draft, publish **one** manually. Confirm it appears.
5. Enable Messenger: save verify token → add webhook → subscribe fields → send the Page a message
   from your personal account → reply from PosterPal.
6. (Optional) Fourthwall Meta Shop: Commerce Manager → create shop + catalog → Fourthwall →
   Apps → Instagram & Facebook Shop → connect → paste Fourthwall **checkout URL** → shipping
   profile → publish → product sync happens on Fourthwall's side.
7. Only if you ever need non-role users: App Review for the exact permissions you use, with the
   privacy policy + screencast Meta asks for.

## 9. Things that will bite you

- Page tokens can expire/be invalidated by password change → Graph 190 → reconnect (PosterPal marks
  the vault invalid instead of failing silently).
- `127.0.0.1` vs `localhost` are different OAuth redirect URIs. PosterPal canonicalises to
  127.0.0.1; be consistent in the Meta dashboard.
- Insights need ≥100 Page likes; post-level reactions still sync.
- Graph schedule window is **10 min – 30 days**; outside it PosterPal keeps a local slot.
- Reels: 9:16, 3–90 s, ≥540×960, max **30 API-published Reels / rolling 24 h** (desk warns 25,
  blocks 30).
- Deauthorise/Data Deletion callbacks are expected for public apps; for a personal Development
  Mode desk you can document deletion as "delete the PosterPal data dir / Docker volume".
