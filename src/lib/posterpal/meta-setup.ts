/**
 * How a homemade desk talks to a Meta developer app — Graph v26.0 only.
 * Distilled from official docs (Login flow, Pages API, secure-requests,
 * automated-data-collection). The Agent may explain these steps. A human
 * still pastes App ID/Secret and clicks Facebook Login. Never scrape.
 */

export const META_CREATE_APP = "https://developers.facebook.com/apps/creation/";
export const META_APPS_DASHBOARD = "https://developers.facebook.com/apps/";
export const META_LOGIN_FLOW = "https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow/";
export const META_PAGES_API = "https://developers.facebook.com/documentation/pages-api";
export const META_SECURE_REQUESTS = "https://developers.facebook.com/docs/graph-api/guides/secure-requests/";
export const META_NO_SCRAPE = "https://developers.facebook.com/documentation/development/terms-and-policies/automated-data-collection";
export const META_GRAPH_EXPLORER = "https://developers.facebook.com/tools/explorer";

/** Meta App IDs are numeric. Display names are not App IDs. */
export function looksLikeAppId(raw: string): boolean {
  return /^\d{5,20}$/.test(raw.trim());
}

export function wantsConnect(brief: string): boolean {
  return /\b(app id|app secret|meta app|meta developer|facebook login|oauth redirect|connect (facebook|this desk)|graph api|developers\.facebook|paste (the )?secret)\b/i.test(
    brief,
  );
}

export const EASY_CONNECT_STEPS = [
  {
    n: 1,
    title: "Create a Meta app (2 minutes)",
    body: "Open developers.facebook.com → Create app → Other → Business. Display name: PosterPal (not Book/Face/FB/Meta). Keep Development Mode. Add Facebook Login.",
    href: META_CREATE_APP,
  },
  {
    n: 2,
    title: "Copy this desk’s Redirect URI into the app",
    body: "Facebook Login → Settings → Valid OAuth Redirect URIs. Exact match. Client OAuth Login and Web OAuth Login ON. App Domains: hostname only — leave empty on 127.0.0.1.",
    href: META_LOGIN_FLOW,
  },
  {
    n: 3,
    title: "Paste App ID + App Secret here",
    body: "Settings → Basic → App ID, then Show next to App Secret. PosterPal encrypts the secret at rest. The Agent never sees the secret in captions.",
    href: META_APPS_DASHBOARD,
  },
  {
    n: 4,
    title: "You click Connect Facebook Login",
    body: "Official OAuth dialog. Role users (Admin/Developer/Tester) can grant pages_* without App Review. Stay in Development Mode. The Agent cannot complete this click.",
    href: META_LOGIN_FLOW,
  },
] as const;

export const META_HOW_IT_WORKS = [
  {
    title: "What a Meta app is",
    body: "A Meta app is a credential pair (App ID + App Secret) in developers.facebook.com. It is not your Facebook Page. PosterPal is your homemade server. The Meta app is the door Facebook issued so Graph will talk to this desk.",
  },
  {
    title: "How Graph API works",
    body: "After you log in, Facebook returns a short-lived User token. PosterPal exchanges it server-side (App Secret never leaves the server), extends it, then calls GET /me/accounts for Page tokens. Publish uses POST /{page-id}/feed, /photos, /videos, /video_reels — Graph v26.0 only, with HMAC appsecret_proof on every call.",
  },
  {
    title: "What Facebook’s terms allow",
    body: "Platform APIs (graph.facebook.com) are the only allowed programmatic access. Scraping facebook.com, m.facebook.com, cookies, or unofficial login is banned. Auto-like, auto-comment, auto-follow, and Group spam are banned. AI may draft; a human must click Publish and Send. Stay in Development Mode until App Review if you need Live access for people who are not role users.",
  },
  {
    title: "AI + Facebook",
    body: "Meta does not ban AI-written captions. You must not misrepresent AI stills as documentary photos of real events. Branded content needs #ad (or similar). Photoreal people may need disclosure. PosterPal’s Agent drafts; it never posts, likes, or replies by itself.",
  },
  {
    title: "What the Agent may do with your App ID",
    body: "Explain these steps, fetch official developer docs, check that an App ID looks like digits, and hop you to Connect. It cannot log into Facebook for you, cannot invent an App Secret, and cannot skip OAuth. You paste the secret. You click Login.",
  },
] as const;
