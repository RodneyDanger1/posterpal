import { getRequest } from "@tanstack/react-start/server";
import { auth, authConfigured } from "./server";

/**
 * Server-side session resolution (server-only).
 *
 * Because this app runs its OWN Better Auth at same-origin `/api/auth/*`, the
 * session cookie is sent with every request to this app — server functions AND
 * SSR loaders included. So we resolve the user straight from the request cookies
 * via `auth.api.getSession` (no client-minted JWT needed). Never trust a
 * client-supplied user id — only the result of this verification.
 */

/** True when a real database is configured server-side. */
const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

/** Re-export so callers can branch on it without importing `server.ts`. */
export { authConfigured };

/** Dev / single-operator user id. PosterPal is a personal desk — no login required. */
export const DEV_USER_ID = "dev-user";

/**
 * Thrown by `requireUserId` when the caller has no valid session. Carries
 * `status: 401`; the message is a stable contract — match
 * `err.message === "Unauthorized"` client-side to send the visitor to sign-in.
 *
 * PosterPal runs as a single-operator CRM, so this is unused in normal flow
 * (requireUserId falls back to DEV_USER_ID). Kept so authMiddleware's contract
 * still typechecks if a caller opts back into strict sessions.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Resolve the signed-in user from the current request, or `null` when auth isn't
 * configured / nobody is signed in. Safe to call from server functions and SSR
 * loaders.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!authConfigured) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * Resolve the operator id for the current request. When auth is OFF
 * (`VITE_AUTH_ENABLED=false`) it always resolves the shared `dev-user`. When
 * auth is ON it REQUIRES a valid session and throws `UnauthorizedError` (401)
 * otherwise — there is no silent single-operator fallback on a public host.
 */
export async function requireUserId(bearerToken?: string): Promise<string> {
  let token = bearerToken?.trim() || "";
  if (!token) {
    try {
      const request = getRequest();
      const header = request?.headers.get("authorization") ?? "";
      const m = /^Bearer\s+(\S+)/i.exec(header);
      if (m?.[1]) token = m[1];
    } catch {
      /* no request */
    }
  }

  if (token.startsWith("ppd_")) {
    const { resolveDeviceToken } = await import("@/lib/posterpal/devices");
    const device = await resolveDeviceToken(token);
    if (!device) throw new UnauthorizedError();
    return device.userId;
  }

  if (!authConfigured) return DEV_USER_ID;
  const user = await getSessionUser(token || undefined);
  if (!user) throw new UnauthorizedError();
  return user.id;
}

void databaseConfigured;
