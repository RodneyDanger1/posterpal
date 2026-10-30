import { auth } from "./server";
import { getSql } from "../db";

/**
 * First-run operator bootstrap + credential reconciliation.
 *
 * `POSTERPAL_ADMIN_EMAIL` / `POSTERPAL_ADMIN_PASSWORD` are the DECLARED source of
 * truth for the seeded operator credential on this self-host stack (the values in
 * the 600-mode `.env`). They are applied on every boot:
 *
 *   1. no user yet           -> create that operator (first run)
 *   2. operator email exists -> make its password hash match the env value
 *      (a rotated env password or a drifted DB credential is repaired; the
 *      previous behaviour created the user once and then silently ignored the
 *      env, so the env and the login stopped agreeing)
 *   3. some other user exists and none matches the env email -> leave it alone
 *      and log a warning (never hijack someone else's account)
 *
 * The check is a real password verify against the stored Better Auth hash, not a
 * string compare. Idempotent: a boot with a matching password writes nothing.
 * Kicked fire-and-forget from `server.ts` after the auth config is built; the
 * password is never logged.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.POSTERPAL_ADMIN_EMAIL?.trim();
  const password = process.env.POSTERPAL_ADMIN_PASSWORD;
  if (!email || !password) return;
  try {
    const sql = await getSql();
    const users = await sql<{ id: string; email: string }>`
      select id, email from "user" order by "createdAt" limit 25
    `;
    if (users.length === 0) {
      await auth.api.signUpEmail({ body: { email, password, name: "Operator" } });
      console.log(`[auth] seeded first operator ${email}`);
      return;
    }
    const target = users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase());
    if (!target) {
      console.warn(
        `[auth] ${users.length} user(s) exist but none matches POSTERPAL_ADMIN_EMAIL — credential reconciliation skipped (not hijacking an account).`,
      );
      return;
    }
    // Better Auth's internal adapter is the supported way to reconcile a password
    // server-side (same path password reset uses); the hash format stays Better
    // Auth's, so sign-in continues to verify it.
    const ctx = (await auth.$context) as unknown as {
      internalAdapter: {
        findAccounts(userId: string): Promise<Array<{ providerId?: string; password?: string | null }>>;
        updatePassword(userId: string, password: string): Promise<void>;
      };
      password: {
        hash(value: string): Promise<string>;
        verify(input: { hash: string; password: string }): Promise<boolean>;
      };
    };
    const accounts = await ctx.internalAdapter.findAccounts(target.id);
    const credential = accounts.find((a) => a.providerId === "credential");
    const storedHash = credential?.password;
    if (!storedHash) {
      console.warn(`[auth] operator ${email} has no password credential — credential reconciliation skipped.`);
      return;
    }
    const matches = await ctx.password.verify({ hash: storedHash, password });
    if (matches) return;
    await ctx.internalAdapter.updatePassword(target.id, await ctx.password.hash(password));
    console.log(`[auth] reconciled operator ${email} password from POSTERPAL_ADMIN_PASSWORD (env is authoritative)`);
  } catch (e) {
    console.error("[auth] bootstrap admin failed:", e instanceof Error ? e.message : e);
  }
}
