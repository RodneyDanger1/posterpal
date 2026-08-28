# PosterPal setup

PosterPal is a **personal desk**. Out of the box there is no sign-in: open the app and work. Self-hosts can require an **email/password login wall** instead — see [Self-host with Docker](#self-host-with-docker) below.

Facebook is optional. Practice Pages work offline. Connect a Facebook app only when you want live publish, comment pull, and insights.

## Facebook App display name

**Use PosterPal.** Meta Basic Settings reject Facebook, FB, Meta, Instagram, WhatsApp, **Book**, and **Face** if they read as a Facebook reference. BookBoss was illegal. PosterPal is not.

The setup wizard includes a live name checker. Safe alternatives: PageDesk, ShoreDesk, DeskPages, WinonaDesk.

## Facebook App (Development Mode)

1. Create an app at [developers.facebook.com](https://developers.facebook.com). Choose a type that supports **Facebook Login**.
2. Display name: **PosterPal**.
3. Add the **Facebook Login** product.
4. Enable **Client OAuth Login** and **Web OAuth Login**.
5. Valid OAuth Redirect URIs:
   - This web app: `https://<your-host>/api/facebook/callback`
   - Windows WPF kernel: `http://127.0.0.1:55443/callback/` (exact)
6. **App Domains** (Settings → Basic): the hostname only, no `https://`. Facebook rejects `127.0.0.1` here — leave empty for localhost.
7. **Website Site URL** (Settings → Basic → Add platform → Website): `https://<your-host>/`
8. **Keep Development Mode.** Add the operator as Admin, Developer, or Tester.
9. **App Review is not required** if only app roles use this desk.
10. Paste App ID + App Secret into PosterPal Settings. Never paste the secret into chat.

**Where those URLs come from:** PosterPal Settings copies them from the URL you are using *right now*. The Grok live preview is not a forever host — after you publish or run the desk on your PC, open Settings on *that* URL and update Facebook.

Official references:

- Pages API posts: [developers.facebook.com/documentation/pages-api/posts](https://developers.facebook.com/documentation/pages-api/posts)
- Basic Settings / display name: [developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings)
- Graph HTTP is used directly (v26.0 + `appsecret_proof`). The Business SDK is optional.
- Meta Devtools MCP (`https://mcp.facebook.com/devtools`) inspects your app. It does not post to Pages.

### Permissions used (role users, no review)

`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_metadata`, `read_insights`, `publish_video`

Page tokens come from `GET /v26.0/me/accounts`. The user must have **CREATE_CONTENT** to publish.

## Graph facts

- Insights need **100+ likes**. Post-level reactions/comments/shares still sync without that.
- Facebook schedule window is **10 minutes–30 days**. Recurring, sooner, or later stays on the local scheduler.
- Unpublished Facebook drafts are `published=false` with **no** `scheduled_publish_time`.
- Reels must be **9:16**, **3–60 seconds**, minimum **540×960**.
- Human-in-the-loop: AI may draft replies. You click Send. No auto-likes, auto-follows, auto-comments.

## Self-host with Docker

The fastest way to run PosterPal on a machine you control, with a real login wall.

### 1. Prepare the secrets

```bash
cp .env.example .env
# fill in at minimum:
#   POSTGRES_PASSWORD        — the postgres superuser password for the compose DB
#   BETTER_AUTH_SECRET       — 32+ random bytes (openssl rand -hex 32)
#   POSTERPAL_MASTER_KEY     — 32+ random bytes (encrypts your Facebook tokens)
#   POSTERPAL_ADMIN_EMAIL    — your login
#   POSTERPAL_ADMIN_PASSWORD — a strong password (seeded on first boot)
```

### 2. Start the stack

```bash
docker compose up -d --build
```

This runs three services: **Postgres 17**, the **app** (Nitro server on :8080, migrations applied on boot), and the **worker** (fires due scheduled posts, syncs Graph, refreshes tokens — even when no browser tab is open).

Open `http://localhost:8080` and sign in with `POSTERPAL_ADMIN_EMAIL` / `POSTERPAL_ADMIN_PASSWORD`.

### 3. Put it behind HTTPS (required for Facebook)

Facebook Login only accepts an HTTPS origin. Put a reverse proxy in front:

- **Caddy** (simplest): `posterpal.example.com { reverse_proxy 127.0.0.1:8080 }` — TLS is automatic.
- **Nginx**: standard `proxy_pass http://127.0.0.1:8080;` with a Let's Encrypt certificate.

Both forward `X-Forwarded-For` by default — keep it on, the login rate limiter keys per client IP through it.

Then set `BETTER_AUTH_URL=https://posterpal.example.com` in `.env` and `docker compose up -d` again, open Settings **on that URL**, and paste the shown App Domain / Site URL / Redirect URI into your Facebook App (see above).

### 4. Backups

```bash
docker compose exec db pg_dump -U posterpal posterpal | gzip > posterpal_$(date +%F).sql.gz
# restore:
gunzip -c posterpal_YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U posterpal posterpal
```

Or on a host with `pg_dump`: `bash scripts/backup.sh ./backups` (keeps the newest 14; `--restore <file>` restores).

### 5. Health

`GET /api/health` → `{"status":"ok","live":true,"db":"up"}`. The compose healthchecks use it; uptime monitors can too.

### How the login wall works

The `build:selfhost` image bakes `VITE_AUTH_ENABLED=true`. On the login screen, account creation is available **only while no operator exists** (first run) and locks afterwards; `POSTERPAL_ADMIN_EMAIL`/`POSTERPAL_ADMIN_PASSWORD` seed the first account at boot. Server functions reject unauthenticated calls with 401 — there is no silent fallback. Brute-force protection: 5 sign-in attempts/min, 10 sign-ups/hour.

Run `npm run dev` (or `npm run build`) for the personal-desk mode with **no login** — that is still the default for localhost use.

## Install on your phone or desktop (PWA)

PosterPal is an installable Progressive Web App — no App Store, no APK sideloading, no build step.

1. Open your PosterPal URL (an **HTTPS** origin, e.g. behind the reverse proxy above — install prompts require HTTPS, except on `localhost`).
2. **iPhone/iPad (Safari):** Share → *Add to Home Screen*. **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*. **Desktop (Chrome/Edge):** the install icon in the address bar.
3. It launches full-screen like a native app, with the PosterPal icon and its own window.

The service worker caches only the app shell (never your data, tokens, or session), so an installed desk opens instantly and shows a graceful screen when offline — but every draft, publish, and sign-in still goes straight to the network. The phone still cannot auto-post: you tap **Publish**, same as the desktop. Pair a phone to an existing desk from **Settings → Devices**.

