# PosterPal setup

PosterPal is a **personal desk**. There is no Google, X, or email sign-in. Open the app and work.

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
