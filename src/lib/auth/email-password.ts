/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * On by default so a standalone self-host can require a real login. It only
 * takes effect when auth is enabled (`VITE_AUTH_ENABLED` not "false"); the
 * personal localhost desk (auth off) still resolves the shared dev user.
 * The sign-up / sign-in forms live in `src/routes/login.tsx`.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;
