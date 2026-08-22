# PosterPal

Personal CRM for the Facebook Pages you administer. Compose, schedule, publish, moderate, and analyze — then monetize through better content ops, not banned engagement automation.

**Official Graph API v26.0 only.** No scraping, no unofficial login, no auto-likes, no auto-comments. AI may draft replies; a human clicks Send.

**No app login.** This is a single-operator desk. Open it and work. Facebook is optional: connect a Development Mode app only when you want posts to hit a real Page.

**Facebook App name:** register it as **PosterPal**. Meta rejects Book / Face / FB / Facebook / Meta. That is why this desk is no longer BookBoss.

## What you can do here

1. Open the desk. Skip setup with **practice Pages** (North Shore Books + Winona Weekend), or connect Facebook.
2. Composer: caption, local media (uploaded to Graph as multipart / rupload), merch CTA, policy checklist, cadence guard, three AI variants.
3. Calendar: month / week / heatmap. Drag to reschedule.
4. Inbox: needs-reply queue. **Pull from Facebook** imports live comments. Drafts are suggestions. Send is always you. Hide hits Graph.
5. Analytics: 7 / 28 / 90 day charts + CSV. Sync pulls reactions/comments/shares from Graph. Page insights require 100+ likes.
6. Settings: Facebook App ID/Secret (encrypted), cadence caps, dark theme, brand voice.

## Facebook (Development Mode)

App Review is **not** required if only app roles use it.

- Product: Facebook Login — Client OAuth Login and Web OAuth Login on
- Valid OAuth Redirect URI: `{this-origin}/api/facebook/callback`
- Desktop WPF loopback (when you compile the Windows kernel): `http://127.0.0.1:55443/callback/`
- Scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_metadata`, `read_insights`, `publish_video`
- Page tokens come from `GET /me/accounts`. `CREATE_CONTENT` is required to publish; analyze-only Pages import as read-only.
- Facebook schedule window: 10 minutes–30 days. Outside that, the local scheduler keeps the post.
- Reels: 9:16, 3–60s, min 540×960.

See [SETUP.md](SETUP.md).

## Architecture

- **Web (this app):** TanStack Start, Postgres/PGLite, Graph v26.0 with `appsecret_proof`, AES-GCM token vault, Grok for captions/replies when `XAI_API_KEY` is present. One operator identity — no Google/X/email gate.
- **Windows desktop:** Graph + policy kernel in [`desktop/`](desktop/). Compile on Windows 10/11 x64 with the .NET 9 SDK — this environment is Linux and cannot produce the `.exe`.

**Next-agent / competitive plan:** [Surpass.md](Surpass.md) — full code map, competitor gaps, self-host + APK, Meta AI/automation rules, Phase 0 bug list.

Facebook Login is bound to the hostname you paste in App Domains / Site URL / Redirect URI. The Grok preview hostname can change. A published HTTPS URL or a machine you leave on is the production host. A phone APK talks to that same HTTPS origin — it cannot reach `127.0.0.1` on your PC.

## Policy, always on

- Per-Page cadence: warn at 8 posts/24h, block at a configurable hard cap (default 20).
- Duplicate-text check vs last 30 posts, branded-content disclosure if a merch link is present, empty caption, missing alt text, AI-media reminder. Blocking flags are enforced on the server, not just the UI.
- Graph errors degrade: 190 → re-auth; 4/17/32/613/80001 → backoff; draft/schedule capability misses save locally and toast a precise error. Never silent, never crash.
