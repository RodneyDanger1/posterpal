/**
 * Official Meta developer documentation only.
 * We fetch public developers.facebook.com pages (no cookies, no facebook.com
 * social graph). Creating Pages / logging in happens in Facebook's own UI
 * that the operator opens — never scraped, never unofficial login.
 */

export type OfficialGuide = {
  id: string;
  title: string;
  url: string;
  why: string;
  /** Only developers.facebook.com / developers.meta.com may be fetched. */
  fetchable: boolean;
};

export const OFFICIAL_GUIDES: OfficialGuide[] = [
  {
    id: "create-app",
    title: "Create a Facebook App",
    url: "https://developers.facebook.com/docs/development/create-an-app",
    why: "You need a Meta app in Development Mode. PosterPal talks to Graph through that app — not through scraping.",
    fetchable: true,
  },
  {
    id: "basic-settings",
    title: "App dashboard · Basic settings",
    url: "https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings",
    why: "App Domains, Site URL, and display name live here. Display name must be PosterPal (Book / Face / FB / Meta are rejected).",
    fetchable: true,
  },
  {
    id: "login",
    title: "Facebook Login (manual flow)",
    url: "https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow",
    why: "PosterPal uses the official OAuth dialog + authorization code. Client OAuth Login and Web OAuth Login must be ON.",
    fetchable: true,
  },
  {
    id: "pages-api",
    title: "Pages API · posts",
    url: "https://developers.facebook.com/documentation/pages-api/posts",
    why: "Publish, schedule (10 minutes–30 days), photos, Reels, and unpublished drafts. This is the API PosterPal calls.",
    fetchable: true,
  },
  {
    id: "permissions",
    title: "Permissions reference",
    url: "https://developers.facebook.com/docs/permissions",
    why: "Role users (Admin / Developer / Tester) can grant pages_* scopes without App Review. Going Live without review strips them.",
    fetchable: true,
  },
  {
    id: "apps-dashboard",
    title: "Your apps dashboard",
    url: "https://developers.facebook.com/apps/",
    why: "Create the app, copy App ID + App Secret, add Facebook Login, paste Redirect URI.",
    fetchable: false,
  },
  {
    id: "explorer",
    title: "Graph API Explorer",
    url: "https://developers.facebook.com/tools/explorer",
    why: "Fallback if the OAuth popup fails: select your app, grant the Pages scopes, Generate Access Token, paste it in PosterPal.",
    fetchable: false,
  },
  {
    id: "secure",
    title: "Secure Graph calls (appsecret_proof)",
    url: "https://developers.facebook.com/docs/graph-api/guides/secure-requests/",
    why: "PosterPal HMAC-signs every Graph call. Enable Require App Secret on the Meta app so stolen tokens fail without the proof.",
    fetchable: true,
  },
  {
    id: "no-scrape",
    title: "Automated data collection (allowed vs banned)",
    url: "https://developers.facebook.com/documentation/development/terms-and-policies/automated-data-collection",
    why: "graph.facebook.com is allowed. Scraping facebook.com is banned. PosterPal only uses Graph.",
    fetchable: true,
  },
  {
    id: "create-page",
    title: "Create a Facebook Page",
    url: "https://www.facebook.com/pages/creation/",
    why: "Graph cannot create Pages. Open Facebook's official creator, make unique Pages, add yourself as Admin, then Connect here to import them.",
    fetchable: false,
  },
];

const ALLOWED_HOSTS = new Set(["developers.facebook.com", "developers.meta.com"]);

export function isAllowedDocsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (!ALLOWED_HOSTS.has(u.hostname)) return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function stripHtmlToText(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const title = (noScript.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const desc =
    noScript.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ??
    noScript.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ??
    "";
  const main =
    noScript.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    noScript.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    "";
  const body = (main || noScript)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const parts = [title, desc, body].filter(Boolean);
  return parts.join("\n\n").slice(0, 4000);
}

export type FetchedGuide = {
  url: string;
  title: string;
  text: string;
  live: boolean;
  error?: string;
};

const cache = new Map<string, { at: number; value: FetchedGuide }>();
const CACHE_MS = 60 * 60 * 1000;

export async function fetchOfficialGuide(url: string): Promise<FetchedGuide> {
  if (!isAllowedDocsUrl(url)) {
    return {
      url,
      title: "Blocked",
      text: "PosterPal only loads official Meta developer documentation (developers.facebook.com). It will not fetch facebook.com, m.facebook.com, or any Page as a visitor — that would be scraping.",
      live: false,
      error: "url_not_allowed",
    };
  }
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "PosterPal/1.0 (personal Facebook Pages desk; reads public developer docs only)",
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      const value: FetchedGuide = {
        url,
        title: "Official page",
        text: `Meta returned HTTP ${res.status}. Open the official page in a new window — the dashboard is a logged-in UI we do not scrape.`,
        live: false,
        error: `http_${res.status}`,
      };
      cache.set(url, { at: Date.now(), value });
      return value;
    }
    const html = await res.text();
    const text = stripHtmlToText(html);
    const title = text.split("\n")[0]?.slice(0, 120) || "Official documentation";
    const value: FetchedGuide = {
      url,
      title,
      text: text || "This Meta page is a logged-in app (JavaScript). Open it in a new window to follow the official steps.",
      live: text.length > 80,
    };
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch (e) {
    return {
      url,
      title: "Could not load",
      text: e instanceof Error ? e.message : "Network error. Open the official page instead.",
      live: false,
      error: "fetch_failed",
    };
  }
}

export const CONNECT_STEPS = [
  {
    id: "1",
    title: "Create the Meta app",
    body: "Open developers.facebook.com/apps → Create app. Pick a type that supports Facebook Login. Display name: PosterPal. Keep Development Mode.",
    guideId: "create-app",
    openId: "apps-dashboard",
  },
  {
    id: "2",
    title: "Add Facebook Login",
    body: "Add the Facebook Login product. Turn Client OAuth Login and Web OAuth Login ON. Paste the Valid OAuth Redirect URI from this desk (copied below).",
    guideId: "login",
    openId: "apps-dashboard",
  },
  {
    id: "3",
    title: "App Domains + Site URL",
    body: "Settings → Basic: App Domains is the hostname only (Facebook rejects 127.0.0.1 here — leave empty on localhost). Add platform → Website → Site URL. Save Changes, wait 30 seconds.",
    guideId: "basic-settings",
    openId: "apps-dashboard",
  },
  {
    id: "4",
    title: "Add yourself as a role user",
    body: "Roles → Admins / Developers / Testers: add the Facebook user who admins the Pages. App Review is not required for role users. Do not switch the app to Live.",
    guideId: "permissions",
    openId: "apps-dashboard",
  },
  {
    id: "5",
    title: "Create unique Pages on Facebook",
    body: "Graph cannot create Pages. Open Facebook’s official Page creator. Distinct name, category, about, and profile art for each. Add yourself as Admin.",
    guideId: "create-page",
    openId: "create-page",
  },
  {
    id: "6",
    title: "Save App ID + Secret here, then Connect",
    body: "Paste App ID and App Secret (encrypted at rest). Connect opens the official Facebook Login dialog in a popup — never inside this iframe, never via cookies we stored.",
    guideId: "login",
    openId: "apps-dashboard",
  },
] as const;
