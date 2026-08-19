# PosterPal setup

PosterPal is a **personal desk**. There is no Google, X, or email sign-in. Open the app and work.

Facebook is optional. Practice Pages work offline. Connect a Facebook app only when you want live publish, comment pull, and insights.

## Facebook App display name (required reading)

**Do not name the Facebook App “PosterPal”.**

Meta Basic Settings reject names that include Facebook, FB, Meta, Instagram, WhatsApp, **Book**, or **Face** if they could be read as a Facebook reference.

- This product (the desk you are using) is PosterPal.
- The app you create at [developers.facebook.com](https://developers.facebook.com) must be named something else.

Safe examples: **PageDesk**, **ShoreDesk**, **DeskPages**, **PageOps**, **WinonaDesk**.

The setup wizard includes a live name checker.

## Facebook App (Development Mode)

1. Create an app at [developers.facebook.com](https://developers.facebook.com). Choose a type that supports **Facebook Login**.
2. Add the **Facebook Login** product.
3. Enable **Client OAuth Login** and **Web OAuth Login**.
4. Valid OAuth Redirect URIs:
   - This web app: `https://<your-host>/api/facebook/callback`
   - Windows WPF kernel: `http://127.0.0.1:55443/callback/` (exact — do not pick another port)
5. **Keep Development Mode.** Add the operator as Admin, Developer, or Tester.
6. **App Review is not required** if only app roles use this desk.

Official references:

- Pages API posts (schedule window, unpublished drafts): [developers.facebook.com/documentation/pages-api/posts](https://developers.facebook.com/documentation/pages-api/posts)
- Basic Settings / display name: [developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings)
- Graph HTTP is used directly (v26.0 + `appsecret_proof`). The Business SDK is optional; this desk does not require it.
- Meta Devtools MCP (`https://mcp.facebook.com/devtools`) can inspect your app, App Review, and rate limits from an IDE — it does not replace Graph publishing.

### Permissions used (role users, no review)

`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_metadata`, `read_insights`, `publish_video`

Page tokens come from `GET /v26.0/me/accounts`. The user must have **CREATE_CONTENT** to publish.

## Graph facts

- Insights need **100+ likes**. Post-level reactions/comments/shares still sync without that.
- Facebook schedule window is **10 minutes–30 days**. Recurring, sooner, or later stays on the local scheduler.
- Unpublished Facebook drafts are `published=false` with **no** `scheduled_publish_time` (Pages API docs).
- Reels must be **9:16**, **3–60 seconds**, minimum **540×960**.
- Human-in-the-loop: AI may draft replies. You click Send. No auto-likes, auto-follows, auto-comments.
