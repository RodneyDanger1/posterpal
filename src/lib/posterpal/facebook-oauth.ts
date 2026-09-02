import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "./crypto";
import { GRAPH_BASE, graphCollect, GraphRequestError, graphFetch, REQUIRED_SCOPES } from "./graph";
import { publicOrigin, redirectCandidates } from "./oauth-origin";
import { setSetting } from "./repo";

export async function handleFacebookCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (err) {
    await rememberError("anonymous", `Facebook returned: ${err}`, publicOrigin(request));
    return htmlResult(`Facebook returned an error: ${err}`, false, publicOrigin(request));
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return htmlResult("Missing code or state from Facebook.", false, publicOrigin(request));

  const sql = await getSql();
  let userId: string | undefined;
  let storedRedirect: string | null = null;
  try {
    const states = await sql<{ user_id: string; redirect_uri: string | null }>`
      select user_id, redirect_uri from oauth_states where state = ${state} and expires_at > now()
    `;
    userId = states[0]?.user_id;
    storedRedirect = states[0]?.redirect_uri ?? null;
  } catch {
    const states = await sql<{ user_id: string }>`
      select user_id from oauth_states where state = ${state} and expires_at > now()
    `;
    userId = states[0]?.user_id;
  }
  if (!userId) {
    return htmlResult("OAuth state expired or invalid. Close this window and click Connect again.", false, publicOrigin(request));
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
    await rememberError(userId, "Facebook App ID or Secret is missing. Save them in Settings first.", publicOrigin(request));
    return htmlResult("Facebook App ID or Secret is missing. Save them in Settings first.", false, publicOrigin(request));
  }

  try {
    const short = await exchangeCode(appId, appSecret, code, request, storedRedirect);
    if (!short.access_token) {
      await rememberError(userId, "Token exchange returned no access_token.", publicOrigin(request));
      return htmlResult("Token exchange returned no access_token.", false, publicOrigin(request));
    }

    const imported = await persistUserToken(userId, {
      appId,
      appSecret,
      shortToken: short.access_token,
      expiresIn: short.expires_in,
    });
    await setSetting(userId, "facebook_last_error", null, false);
    await setSetting(userId, "facebook_last_connect_ok", "1", false);
    await setSetting(userId, "facebook_last_connect_at", new Date().toISOString(), false);
    return htmlResult(
      `Connected. Imported ${imported} Page${imported === 1 ? "" : "s"}. You can close this window.`,
      true,
      publicOrigin(request),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await rememberError(userId, msg, publicOrigin(request));
    return htmlResult(`Facebook connect failed: ${msg}`, false, publicOrigin(request));
  }
}

export async function importPastedUserToken(
  userId: string,
  rawToken: string,
): Promise<{ imported: number }> {
  const token = rawToken.trim();
  if (token.length < 20) throw new Error("That does not look like a Facebook user token.");
  const sql = await getSql();
  const appRows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_id'
  `;
  const secretRows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_secret'
  `;
  const appId = appRows[0]?.value_plain ?? decryptSecret(appRows[0]?.value_enc) ?? "";
  const appSecret = decryptSecret(secretRows[0]?.value_enc) ?? secretRows[0]?.value_plain ?? "";
  if (!appId || !appSecret) {
    throw new Error("Save App ID and App Secret in Settings first, then paste the token.");
  }
  const imported = await persistUserToken(userId, {
    appId,
    appSecret,
    shortToken: token,
  });
  await setSetting(userId, "facebook_last_error", null, false);
  await setSetting(userId, "facebook_last_connect_ok", "1", false);
  await setSetting(userId, "facebook_last_connect_at", new Date().toISOString(), false);
  return { imported };
}

async function persistUserToken(
  userId: string,
  input: { appId: string; appSecret: string; shortToken: string; expiresIn?: number },
): Promise<number> {
  const sql = await getSql();
  let longLived = input.shortToken;
  let expiresAt: string | null = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;
  try {
    const longTok = await exchangeToken({
      grant_type: "fb_exchange_token",
      client_id: input.appId,
      client_secret: input.appSecret,
      fb_exchange_token: input.shortToken,
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
      token: `${input.appId}|${input.appSecret}`,
      appSecret: input.appSecret,
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

  await sql`update token_vault set is_valid = false where user_id = ${userId} and is_valid = true`;
  await sql`
    insert into token_vault (
      id, user_id, name, user_token_enc, long_lived_token_enc, expires_at,
      data_access_expires_at, scopes, last_validated_at, is_valid
    ) values (
      ${randomUUID()}, ${userId}, ${"Facebook user"}, ${encryptSecret(input.shortToken)},
      ${encryptSecret(longLived)}, ${expiresAt}, ${dataAccessExpires}, ${scopes}, now(), ${isValid}
    )
  `;
  return importFacebookAccounts(userId, longLived, input.appSecret);
}

export async function importFacebookAccounts(userId: string, userToken: string, appSecret: string): Promise<number> {
  const sql = await getSql();
  const accounts = await graphCollect<{
    id: string;
    name: string;
    access_token?: string;
    category?: string;
    fan_count?: number;
    tasks?: string[];
    picture?: { data?: { url?: string; is_silhouette?: boolean } };
  }>({
    path: "/me/accounts",
    token: userToken,
    appSecret,
    query: { fields: "id,name,access_token,category,category_list,fan_count,tasks,picture{url,is_silhouette}" },
  });

  let imported = 0;
  for (const acct of accounts) {
    const tasks = acct.tasks ?? null;
    const canCreate = tasks ? tasks.includes("CREATE_CONTENT") : true;
    const pictureUrl =
      acct.picture?.data?.url && !acct.picture.data.is_silhouette ? acct.picture.data.url : null;
    const existing = await sql<{ id: string }>`
      select id from pages where user_id = ${userId} and facebook_page_id = ${acct.id}
    `;
    if (existing[0]) {
      await sql`
        update pages set
          name = ${acct.name},
          category = ${acct.category ?? null},
          fan_count = ${acct.fan_count ?? 0},
          picture_url = coalesce(${pictureUrl}, picture_url),
          tasks_json = coalesce(${tasks ? JSON.stringify(tasks) : null}, tasks_json),
          access_token_enc = coalesce(${acct.access_token ? encryptSecret(acct.access_token) : null}, access_token_enc),
          is_read_only = coalesce(${tasks ? !canCreate : null}, is_read_only),
          is_practice = false,
          updated_at = now()
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into pages (
          id, user_id, facebook_page_id, name, category, fan_count, tasks_json,
          access_token_enc, is_active, is_read_only, is_practice, picture_url
        ) values (
          ${randomUUID()}, ${userId}, ${acct.id}, ${acct.name}, ${acct.category ?? null},
          ${acct.fan_count ?? 0}, ${JSON.stringify(tasks ?? [])},
          ${acct.access_token ? encryptSecret(acct.access_token) : null},
          true, ${!canCreate}, false, ${pictureUrl}
        )
      `;
    }
    imported += 1;
  }
  if (imported > 0) {
    await setSetting(userId, "hide_practice", "1", false);
    const firstLive = await sql<{ id: string }>`
      select id from pages
      where user_id = ${userId} and is_practice = false and is_active = true
      order by name
      limit 1
    `;
    if (firstLive[0]?.id) await setSetting(userId, "default_page_id", firstLive[0].id, false);
  }
  return imported;
}

/** Re-exchange a long-lived user token (extends ~60 days) and refresh Page tokens from /me/accounts. */
export async function refreshVaultTokens(userId: string): Promise<{ refreshed: boolean; warning: string | null }> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    long_lived_token_enc: string | null;
    expires_at: string | null;
    last_validated_at: string | null;
  }>`
    select id, long_lived_token_enc, expires_at, last_validated_at
    from token_vault
    where user_id = ${userId} and is_valid = true
    order by created_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return { refreshed: false, warning: null };
  const token = decryptSecret(row.long_lived_token_enc);
  if (!token) return { refreshed: false, warning: null };

  const appRows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_id'
  `;
  const secretRows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = 'facebook_app_secret'
  `;
  const appId = appRows[0]?.value_plain ?? decryptSecret(appRows[0]?.value_enc) ?? "";
  const appSecret = decryptSecret(secretRows[0]?.value_enc) ?? secretRows[0]?.value_plain ?? "";
  if (!appId || !appSecret) return { refreshed: false, warning: null };

  const now = Date.now();
  const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const last = row.last_validated_at ? new Date(row.last_validated_at).getTime() : 0;
  const expiringSoon = exp > 0 && exp - now < 21 * 86_400_000;
  if (now - last < 6 * 60 * 60 * 1000) return { refreshed: false, warning: null };
  if (!expiringSoon && exp > now) return { refreshed: false, warning: null };

  try {
    const longTok = await exchangeToken({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: token,
    });
    const next = longTok.access_token || token;
    const expiresAt = longTok.expires_in
      ? new Date(Date.now() + longTok.expires_in * 1000).toISOString()
      : row.expires_at;
    await sql`
      update token_vault set
        long_lived_token_enc = ${encryptSecret(next)},
        expires_at = ${expiresAt},
        last_validated_at = now(),
        is_valid = true
      where id = ${row.id}
    `;
    await importFacebookAccounts(userId, next, appSecret);
    return { refreshed: true, warning: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof GraphRequestError && e.mapped.kind === "token") {
      await sql`update token_vault set is_valid = false, last_validated_at = now() where id = ${row.id}`;
    }
    return { refreshed: false, warning: msg };
  }
}

async function exchangeCode(
  appId: string,
  appSecret: string,
  code: string,
  request: Request,
  storedRedirect?: string | null,
): Promise<{ access_token?: string; expires_in?: number }> {
  const candidates = redirectCandidates(request, storedRedirect);
  let last: Error | null = null;
  for (const redirect_uri of candidates) {
    try {
      return await exchangeToken({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri,
        code,
      });
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last ?? new Error("Token exchange failed. The Redirect URI on the Facebook App must be exactly http://127.0.0.1:8080/api/facebook/callback");
}

async function rememberError(userId: string, message: string, origin: string) {
  try {
    if (userId && userId !== "anonymous") {
      await setSetting(userId, "facebook_last_error", message.slice(0, 500), false);
      await setSetting(userId, "facebook_last_redirect", `${origin}/api/facebook/callback`, false);
      await setSetting(userId, "facebook_last_connect_ok", "0", false);
    }
  } catch {
    /* best-effort */
  }
}

async function exchangeToken(params: Record<string, string>): Promise<{ access_token?: string; expires_in?: number }> {
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
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

function htmlResult(message: string, ok: boolean, origin: string): Response {
  const payload = JSON.stringify({ source: "posterpal-facebook", ok, message });
  let hostname = "";
  let siteUrl = origin;
  let redirect = `${origin}/api/facebook/callback`;
  try {
    const u = new URL(origin);
    hostname = u.hostname;
    siteUrl = `${u.protocol}//${u.host}`;
    redirect = `${siteUrl}/api/facebook/callback`;
  } catch {
    /* keep origin */
  }
  const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  const extra = ok
    ? `<p style="color:#65676B;font-size:13px">You can close this tab and go back to PosterPal.</p>`
    : loopback
      ? `<div style="margin-top:16px;padding:12px;background:#fff;border-radius:8px;font-size:13px;line-height:1.45;color:#050505">
        <p style="margin:0 0 8px"><strong>On the Windows app, Facebook Login is loopback-only.</strong> Leave App Domains empty (Facebook rejects IP addresses). Put exactly this Redirect URI in Facebook Login → Settings → Valid OAuth Redirect URIs:</p>
        <code style="display:block;padding:8px;background:#F0F2F5;border-radius:6px;word-break:break-all">http://127.0.0.1:8080/api/facebook/callback</code>
        <p style="margin:12px 0 0">Client OAuth Login and Web OAuth Login ON. You must be Admin/Developer/Tester. Display name PosterPal. Save Changes, wait 30 seconds, Connect again from the Windows window (not the phone).</p>
        <p style="margin:12px 0 0">Still stuck: Graph API Explorer → select <em>your</em> app → grant the Pages permissions → Generate Access Token → paste it in PosterPal Settings. Never paste App Secret in chat.</p>
      </div>
      <p style="margin-top:16px"><button onclick="window.close()" style="padding:8px 14px;border:0;border-radius:6px;background:#1877F2;color:#fff;font-weight:600;cursor:pointer">Close</button></p>`
      : `<div style="margin-top:16px;padding:12px;background:#fff;border-radius:8px;font-size:13px;line-height:1.45;color:#050505">
        <p style="margin:0 0 8px"><strong>Facebook “domain isn’t included”</strong> — add these three, then Save Changes:</p>
        <p style="margin:8px 0 0">App Domains (Settings → Basic)</p>
        <code style="display:block;padding:8px;background:#F0F2F5;border-radius:6px;word-break:break-all">${escapeHtml(hostname)}</code>
        <p style="margin:8px 0 0">Website Site URL (Settings → Basic → Add platform → Website)</p>
        <code style="display:block;padding:8px;background:#F0F2F5;border-radius:6px;word-break:break-all">${escapeHtml(siteUrl)}/</code>
        <p style="margin:8px 0 0">Valid OAuth Redirect URI (Facebook Login → Settings)</p>
        <code style="display:block;padding:8px;background:#F0F2F5;border-radius:6px;word-break:break-all">${escapeHtml(redirect)}</code>
        <p style="margin:12px 0 0">Wait 30 seconds after saving. Client OAuth Login and Web OAuth Login must be ON. You must be Admin/Developer/Tester. Display name PosterPal (not Book).</p>
        <p style="margin:12px 0 0">If it still fails: Settings → paste a User Token from Graph API Explorer (select your app). Never paste App Secret in chat.</p>
      </div>
      <p style="margin-top:16px"><button onclick="window.close()" style="padding:8px 14px;border:0;border-radius:6px;background:#1877F2;color:#fff;font-weight:600;cursor:pointer">Close</button></p>`;
  const body = `<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;padding:32px;background:#F0F2F5;color:#050505;max-width:560px">
  <p style="font-size:16px">${escapeHtml(message)}</p>
  ${extra}
  <script>
    try { window.opener && window.opener.postMessage(${payload}, "*"); } catch (e) {}
    ${ok ? "setTimeout(function(){ window.close(); }, 700);" : ""}
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
