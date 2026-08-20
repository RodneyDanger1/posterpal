/** Server-only: pick the origin Facebook will actually redirect to. */

export function publicOrigin(request: Request): string {
  const publicHost = process.env.VITE_PUBLIC_HOSTNAME?.trim();
  if (publicHost) return `https://${publicHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const local = forwardedHost.includes("localhost") || forwardedHost.startsWith("127.");
    const proto = forwardedProto || (local ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
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
  if (!allowed.has(parsed.host)) {
    throw new Error(`Redirect host ${parsed.host} is not this desk. Use ${fallback}`);
  }
  return `${parsed.origin}/api/facebook/callback`;
}

export function redirectCandidates(request: Request): string[] {
  const set = new Set<string>();
  set.add(`${publicOrigin(request)}/api/facebook/callback`);
  set.add(`${new URL(request.url).origin}/api/facebook/callback`);
  return [...set];
}
