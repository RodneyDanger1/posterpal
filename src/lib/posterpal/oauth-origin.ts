/** Server-only: pick the origin Facebook will actually redirect to. */

/** Facebook treats localhost and 127.0.0.1 as different redirect URIs. Always 127.0.0.1. */
export function canonicalOrigin(origin: string): string {
  try {
    const u = new URL(origin.includes("://") ? origin : `http://${origin}`);
    if (u.hostname === "localhost" || u.hostname === "::1") u.hostname = "127.0.0.1";
    return u.origin;
  } catch {
    return origin.replace(/localhost/gi, "127.0.0.1");
  }
}

export function desktopLoopbackCallback(): string {
  const port = Number(process.env.PORT || process.env.NITRO_PORT || 8080) || 8080;
  return `http://127.0.0.1:${port}/api/facebook/callback`;
}

export function publicOrigin(request: Request): string {
  const publicHost = process.env.VITE_PUBLIC_HOSTNAME?.trim();
  if (publicHost) return `https://${publicHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const local = forwardedHost.includes("localhost") || forwardedHost.startsWith("127.");
    const proto = forwardedProto || (local ? "http" : "https");
    return canonicalOrigin(`${proto}://${forwardedHost}`);
  }
  return canonicalOrigin(new URL(request.url).origin);
}

export function resolveOAuthRedirect(request: Request): string {
  const fallback = `${publicOrigin(request)}/api/facebook/callback`;
  const fromQuery = new URL(request.url).searchParams.get("redirect_uri");
  if (!fromQuery) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(fromQuery);
  } catch {
    throw new Error("Bad redirect_uri.");
  }
  if (parsed.pathname !== "/api/facebook/callback") {
    throw new Error("Redirect URI path must be /api/facebook/callback");
  }
  const allowed = new Set<string>();
  allowed.add(new URL(fallback).host);
  allowed.add(new URL(request.url).host);
  const fh = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fh) allowed.add(fh);
  const ph = process.env.VITE_PUBLIC_HOSTNAME?.trim();
  if (ph) allowed.add(ph.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  allowed.add("127.0.0.1:8080");
  allowed.add("localhost:8080");
  const port = String(process.env.PORT || process.env.NITRO_PORT || 8080);
  allowed.add(`127.0.0.1:${port}`);
  allowed.add(`localhost:${port}`);
  if (!allowed.has(parsed.host) && !allowed.has(parsed.host.replace("localhost", "127.0.0.1"))) {
    throw new Error(`Redirect host ${parsed.host} is not this desk. Use ${fallback}`);
  }
  return `${canonicalOrigin(parsed.origin)}/api/facebook/callback`;
}

export function redirectCandidates(request: Request, stored?: string | null): string[] {
  const set = new Set<string>();
  if (stored) set.add(stored);
  set.add(`${publicOrigin(request)}/api/facebook/callback`);
  set.add(`${canonicalOrigin(new URL(request.url).origin)}/api/facebook/callback`);
  set.add(desktopLoopbackCallback());
  set.add("http://127.0.0.1:8080/api/facebook/callback");
  set.add("http://localhost:8080/api/facebook/callback");
  return [...set];
}
