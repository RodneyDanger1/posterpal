import { auth } from "./server";
import { getSql } from "../db";

/**
 * First-run operator bootstrap. When `POSTERPAL_ADMIN_EMAIL` +
 * `POSTERPAL_ADMIN_PASSWORD` are set and no user exists yet, create that
 * account so a fresh self-host has a known credential. Idempotent — once any
 * user exists it does nothing. Kicked fire-and-forget from `server.ts` after
 * the auth config is built.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.POSTERPAL_ADMIN_EMAIL?.trim();
  const password = process.env.POSTERPAL_ADMIN_PASSWORD;
  if (!email || !password) return;
  try {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from "user"`;
    if ((rows[0]?.n ?? 0) > 0) return;
    await auth.api.signUpEmail({ body: { email, password, name: "Operator" } });
    console.log(`[auth] seeded first operator ${email}`);
  } catch (e) {
    console.error("[auth] bootstrap admin failed:", e instanceof Error ? e.message : e);
  }
}
