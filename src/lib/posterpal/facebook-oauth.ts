import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "./crypto";
import { GRAPH_BASE, graphFetch, REQUIRED_SCOPES } from "./graph";

export async function handleFacebookCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (err) return htmlClose(`Facebook returned an error: ${err}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return htmlClose("Missing code or state from Facebook.");

  const sql = await getSql();
  const states = await sql<{ user_id: string }>`
    select user_id from oauth_states where state = ${state} and expires_at > now()
  `;
  const userId = states[0]?.user_id;
  if (!userId) {
    return htmlClose("OAuth state expired or invalid. Close this window and try Connect again.");
  }
  await sql`delete from oauth_states where state = ${state}`;

  const appRows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_id'
  `;
  const secretRows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_secret'
  `;
  const appId = appRows[0]?.value_plain ?? decryptSecret(appRows[0]?.value_enc) ?? "";
  const appSecret = decryptSecret(secretRows[0]?.value_enc) ?? secretRows[0]?.value_plain ?? "";
  if (!appId || !appSecret) {
    return htmlClose("Facebook App ID or Secret is missing. Save them in Settings first.");
  }

  const redirectUri = `${url.origin}/api/facebook/callback`;
  try {
    const short = await exchangeToken({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });
    if (!short.access_token) return htmlClose("Token exchange returned no access_token.");

    let longLived = short.access_token;
    let expiresAt: string | null = short.expires_in
      ? new Date(Date.now() + short.expires_in * 1000).toISOString()
      : null;
    try {
      const longTok = await exchangeToken({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      });
      if (longTok.access_token) longLived = longTok.access_token;
      if (longTok.expires_in) expiresAt = new Date(Date.now() + longTok.expires_in * 1000).toISOString();
    } catch {
      /* short-lived still usable for /me/accounts */
    }

    let dataAccessExpires: string | null = null;
    let isValid = true;
    let scopes = REQUIRED_SCOPES.join(",");
    try {
      const debug = await graphFetch<{
        data?: {
          is_valid?: boolean;
          scopes?: string[];
          expires_at?: number;
          data_access_expires_at?: number;
        };
      }>({
        path: "/debug_token",
        token: `${appId}|${appSecret}`,
        appSecret,
        query: { input_token: longLived },
      });
      const d = debug.data.data;
      if (d) {
        isValid = d.is_valid !== false;
        if (d.scopes?.length) scopes = d.scopes.join(",");
        if (d.expires_at) expiresAt = new Date(d.expires_at * 1000).toISOString();
        if (d.data_access_expires_at) {
          dataAccessExpires = new Date(d.data_access_expires_at * 1000).toISOString();
        }
      }
    } catch {
      /* debug_token is best-effort */
    }

    await sql`
      insert into token_vault (
        id, user_id, name, user_token_enc, long_lived_token_enc, expires_at,
        data_access_expires_at, scopes, last_validated_at, is_valid
      ) values (
        ${randomUUID()}, ${userId}, ${"Facebook user"}, ${encryptSecret(short.access_token)},
        ${encryptSecret(longLived)}, ${expiresAt}, ${dataAccessExpires}, ${scopes}, now(), ${isValid}
      )
    `;

    const imported = await importFacebookAccounts(userId, longLived, appSecret);
    return htmlClose(`Connected. Imported ${imported} Page${imported === 1 ? "" : "s"}. You can close this window.`, true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return htmlClose(`Facebook connect failed: ${msg}`);
  }
}

export async function importFacebookAccounts(userId: string, userToken: string, appSecret: string): Promise<number> {
  const sql = await getSql();
  const accounts = await graphFetch<{
    data?: Array<{
      id: string;
      name: string;
      access_token?: string;
      category?: string;
      fan_count?: number;
      tasks?: string[];
    }>;
  }>({
    path: "/me/accounts",
    token: userToken,
    appSecret,
    query: { fields: "id,name,access_token,category,category_list,fan_count,tasks" },
  });

  let imported = 0;
  for (const acct of accounts.data.data ?? []) {
    const tasks = acct.tasks ?? [];
    const canCreate = tasks.includes("CREATE_CONTENT");
    const existing = await sql<{ id: string }>`
      select id from pages where user_id = ${userId} and facebook_page_id = ${acct.id}
    `;
    const tokenEnc = acct.access_token ? encryptSecret(acct.access_token) : null;
    if (existing[0]) {
      await sql`
        update pages set
          name = ${acct.name},
          category = ${acct.category ?? null},
          fan_count = ${acct.fan_count ?? 0},
          tasks_json = ${JSON.stringify(tasks)},
          access_token_enc = coalesce(${tokenEnc}, access_token_enc),
          is_read_only = ${!canCreate},
          is_practice = false,
          updated_at = now()
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into pages (
          id, user_id, facebook_page_id, name, category, fan_count, tasks_json,
          access_token_enc, is_active, is_read_only, is_practice
        ) values (
          ${randomUUID()}, ${userId}, ${acct.id}, ${acct.name}, ${acct.category ?? null},
          ${acct.fan_count ?? 0}, ${JSON.stringify(tasks)},
          ${tokenEnc},
          true, ${!canCreate}, false
        )
      `;
    }
    imported += 1;
  }
  return imported;
}

async function exchangeToken(params: Record<string, string>): Promise<{ access_token?: string; expires_in?: number }> {
  const u = new URL(`${GRAPH_BASE}/oauth/access_token`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { method: "GET" });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Token exchange failed (${res.status})`);
  }
  return json;
}

function htmlClose(message: string, ok = false): Response {
  const payload = JSON.stringify({ source: "posterpal-facebook", ok, message });
  const body = `<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;padding:32px;background:#F0F2F5;color:#050505">
  <p>${escapeHtml(message)}</p>
  <script>
    try { window.opener && window.opener.postMessage(${payload}, window.location.origin); } catch (e) {}
    setTimeout(function(){ window.close(); }, 800);
  </script>
  </body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#39;";
  });
}
