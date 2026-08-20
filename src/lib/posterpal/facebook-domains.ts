/** Client-safe. Values Facebook wants in App Domains / Site URL / Redirect URIs. */

export type FacebookDomainHints = {
  hostname: string;
  siteUrl: string;
  redirectUri: string;
  isLoopback: boolean;
};

export function facebookDomainHints(origin?: string): FacebookDomainHints {
  const raw =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8080");
  let hostname = "127.0.0.1";
  let siteUrl = raw.replace(/\/$/, "");
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    hostname = u.hostname;
    siteUrl = `${u.protocol}//${u.host}`.replace(/\/$/, "");
  } catch {
    /* keep defaults */
  }
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  return {
    hostname,
    siteUrl,
    redirectUri: `${siteUrl}/api/facebook/callback`,
    isLoopback,
  };
}
