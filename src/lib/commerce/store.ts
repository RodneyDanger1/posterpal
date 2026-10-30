/**
 * Commerce persistence. Server-only.
 *
 * Credentials: the whole provider credential object is AES-256-GCM encrypted with
 * the same master key the Facebook token vault uses (crypto.ts). Nothing is ever
 * returned to the client except `has_credentials`.
 */
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/posterpal/crypto";
import { FourthwallClient, type FourthwallCredentials, type TrackingParams } from "./fourthwall";
import {
  CommerceError,
  type CheckoutClickRow,
  type CommerceConnectionRow,
  type CommerceOrder,
  type CommerceProduct,
  type CommerceProviderId,
  type ConnectionStatus,
  type WebhookEventRow,
} from "./types";

function asString(v: unknown): string | null {
  return v == null ? null : String(v);
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function listConnections(userId: string): Promise<CommerceConnectionRow[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, user_id, provider, label, status, account_ref, last_sync_at, last_error,
           created_at, updated_at, (credentials_enc is not null) as has_credentials, config_json
    from commerce_connections
    where user_id = ${userId}
    order by created_at asc
  `;
  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    provider: String(r.provider),
    label: String(r.label),
    status: (String(r.status) as ConnectionStatus) || "unverified",
    account_ref: asString(r.account_ref),
    last_sync_at: asString(r.last_sync_at),
    last_error: asString(r.last_error),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    has_credentials: Boolean(r.has_credentials),
    config: parseJson<Record<string, string>>(asString(r.config_json), {}),
  }));
}

export async function getConnection(
  userId: string,
  connectionId: string,
): Promise<{ row: CommerceConnectionRow; creds: FourthwallCredentials } | null> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, user_id, provider, label, status, account_ref, last_sync_at, last_error,
           created_at, updated_at, credentials_enc, config_json
    from commerce_connections
    where user_id = ${userId} and id = ${connectionId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  if (String(r.provider) !== "fourthwall") {
    throw new CommerceError("fourthwall", `Unsupported commerce provider "${String(r.provider)}".`);
  }
  const plain = decryptSecret(asString(r.credentials_enc));
  if (!plain) {
    throw new CommerceError(
      "fourthwall",
      "Stored Fourthwall credentials could not be decrypted. Re-save the connection — the master key changed or is missing.",
    );
  }
  let creds: FourthwallCredentials;
  try {
    const parsed = JSON.parse(plain) as { username?: string; password?: string };
    if (!parsed.username || !parsed.password) throw new Error("missing fields");
    creds = { username: parsed.username, password: parsed.password };
  } catch {
    throw new CommerceError("fourthwall", "Stored Fourthwall credentials are malformed. Re-save the connection.");
  }
  return {
    row: {
      id: String(r.id),
      user_id: String(r.user_id),
      provider: String(r.provider),
      label: String(r.label),
      status: (String(r.status) as ConnectionStatus) || "unverified",
      account_ref: asString(r.account_ref),
      last_sync_at: asString(r.last_sync_at),
      last_error: asString(r.last_error),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      has_credentials: true,
      config: parseJson<Record<string, string>>(asString(r.config_json), {}),
    },
    creds,
  };
}

export async function saveConnection(
  userId: string,
  input: {
    connectionId?: string | null;
    provider: CommerceProviderId;
    label: string;
    /** Blank on update = keep the stored credentials (editing the shop domain must
     *  never overwrite the username/password with placeholder text). */
    username?: string;
    password?: string;
    shopDomain?: string;
  },
): Promise<CommerceConnectionRow> {
  const label = input.label.trim();
  if (!label) throw new CommerceError("fourthwall", "Connection label is required.");
  const username = (input.username ?? "").trim();
  const password = (input.password ?? "").trim();
  if (username && !password) {
    throw new CommerceError("fourthwall", "Enter the Open API password too, or leave both credential fields blank to keep the saved ones.");
  }
  if (!username && password) {
    throw new CommerceError("fourthwall", "Enter the Open API username too, or leave both credential fields blank to keep the saved ones.");
  }
  if (!input.connectionId && (!username || !password)) {
    throw new CommerceError("fourthwall", "Open API username and password are required for a new connection.");
  }
  const sql = await getSql();
  const credentialsEnc = username && password
    ? encryptSecret(JSON.stringify({ username, password }))
    : null;
  const configJson = JSON.stringify({
    shopDomain: (input.shopDomain ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, ""),
  });

  if (input.connectionId) {
    // Only replace credentials when new ones were supplied; otherwise this is a
    // label/domain edit and the stored secret + verification status stay put.
    const rows = credentialsEnc
      ? await sql<{ id: string }>`
          update commerce_connections
          set label = ${label}, credentials_enc = ${credentialsEnc}, config_json = ${configJson},
              status = 'unverified', last_error = null, updated_at = now()
          where id = ${input.connectionId} and user_id = ${userId}
          returning id
        `
      : await sql<{ id: string }>`
          update commerce_connections
          set label = ${label}, config_json = ${configJson}, updated_at = now()
          where id = ${input.connectionId} and user_id = ${userId}
          returning id
        `;
    if (!rows[0]) throw new CommerceError("fourthwall", "Connection not found.");
  } else {
    await sql`
      insert into commerce_connections (id, user_id, provider, label, credentials_enc, config_json)
      values (${randomUUID()}, ${userId}, ${input.provider}, ${label}, ${credentialsEnc}, ${configJson})
      on conflict (user_id, provider, label) do update
        set credentials_enc = coalesce(excluded.credentials_enc, commerce_connections.credentials_enc),
            config_json = excluded.config_json,
            status = 'unverified',
            last_error = null,
            updated_at = now()
    `;
  }
  const all = await listConnections(userId);
  const saved = all.find((c) => c.label === label);
  if (!saved) throw new CommerceError("fourthwall", "Connection saved but could not be read back.");
  return saved;
}

export async function deleteConnection(userId: string, connectionId: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from commerce_connections where id = ${connectionId} and user_id = ${userId}`;
}

export async function updateConnectionStatus(
  userId: string,
  connectionId: string,
  status: ConnectionStatus,
  opts: { accountRef?: string | null; error?: string | null } = {},
): Promise<void> {
  const sql = await getSql();
  await sql`
    update commerce_connections
    set status = ${status},
        account_ref = ${opts.accountRef ?? null},
        last_error = ${opts.error ?? null},
        updated_at = now()
    where id = ${connectionId} and user_id = ${userId}
  `;
}

/**
 * Verify credentials against Fourthwall and record the shop as the account ref.
 * Returns the shop so the UI can show the real shop name/domain.
 */
export async function testConnection(
  userId: string,
  connectionId: string,
): Promise<{ shop: { id: string; name: string; domain: string; publicDomain: string; status: string } }> {
  const found = await getConnection(userId, connectionId);
  if (!found) throw new CommerceError("fourthwall", "Connection not found.");
  const client = new FourthwallClient(found.creds);
  try {
    const shop = await client.getShop();
    const domain = shop.publicDomain || shop.domain;
    await updateConnectionStatus(userId, connectionId, "connected", { accountRef: shop.name || shop.id });
    if (domain) {
      // Persist the shop domain so checkout links work without re-typing it.
      const sql = await getSql();
      await sql`
        update commerce_connections
        set config_json = ${JSON.stringify({ shopDomain: domain })}, updated_at = now()
        where id = ${connectionId} and user_id = ${userId}
      `;
    }
    return { shop };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fourthwall verification failed.";
    await updateConnectionStatus(userId, connectionId, "error", { error: message });
    throw e;
  }
}

/** Pull the shop's offers into commerce_products (upsert by connection + external id). */
export async function syncProducts(userId: string, connectionId: string): Promise<{ synced: number }> {
  const found = await getConnection(userId, connectionId);
  if (!found) throw new CommerceError("fourthwall", "Connection not found.");
  const client = new FourthwallClient(found.creds);
  const sql = await getSql();
  let synced = 0;
  let page = 0;
  let total = Infinity;
  while (synced < total && page < 20) {
    const batch = await client.listProducts({ page, size: 100 });
    total = batch.total;
    if (batch.results.length === 0) break;
    for (const p of batch.results) {
      if (!p.external_id) continue;
      await sql`
        insert into commerce_products (
          id, user_id, connection_id, provider, external_id, name, description, slug,
          state, access, price_cents, currency, image_url, variants_json, updated_at
        ) values (
          ${randomUUID()}, ${userId}, ${connectionId}, ${found.row.provider}, ${p.external_id},
          ${p.name}, ${p.description}, ${p.slug}, ${p.state}, ${p.access},
          ${p.price_cents}, ${p.currency}, ${p.image_url}, ${JSON.stringify(p.variants)}, now()
        )
        on conflict (connection_id, external_id) do update set
          name = excluded.name,
          description = excluded.description,
          slug = excluded.slug,
          state = excluded.state,
          access = excluded.access,
          price_cents = excluded.price_cents,
          currency = excluded.currency,
          image_url = excluded.image_url,
          variants_json = excluded.variants_json,
          updated_at = now()
      `;
      synced += 1;
    }
    if (batch.results.length < 100) break;
    page += 1;
  }
  await sql`
    update commerce_connections set last_sync_at = now(), last_error = null, updated_at = now()
    where id = ${connectionId} and user_id = ${userId}
  `;
  return { synced };
}

export async function syncOrders(userId: string, connectionId: string): Promise<{ synced: number }> {
  const found = await getConnection(userId, connectionId);
  if (!found) throw new CommerceError("fourthwall", "Connection not found.");
  const client = new FourthwallClient(found.creds);
  const sql = await getSql();
  const batch = await client.listOrders({ page: 0, size: 100 });
  let synced = 0;
  for (const o of batch.results) {
    if (!o.external_id) continue;
    await sql`
      insert into commerce_orders (
        id, user_id, connection_id, provider, external_id, friendly_id, status,
        total_cents, currency, email, items_json, tracking_json, provider_created_at, updated_at
      ) values (
        ${randomUUID()}, ${userId}, ${connectionId}, ${found.row.provider}, ${o.external_id},
        ${o.friendly_id}, ${o.status}, ${o.total_cents}, ${o.currency}, ${o.email},
        ${JSON.stringify(o.items)}, ${JSON.stringify(o.tracking)}, ${o.provider_created_at}, now()
      )
      on conflict (connection_id, external_id) do update set
        friendly_id = excluded.friendly_id,
        status = excluded.status,
        total_cents = excluded.total_cents,
        currency = excluded.currency,
        email = excluded.email,
        items_json = excluded.items_json,
        tracking_json = excluded.tracking_json,
        provider_created_at = excluded.provider_created_at,
        updated_at = now()
    `;
    synced += 1;
  }
  await sql`
    update commerce_connections set last_sync_at = now(), updated_at = now()
    where id = ${connectionId} and user_id = ${userId}
  `;
  return { synced };
}

export async function listProducts(userId: string, connectionId?: string): Promise<CommerceProduct[]> {
  const sql = await getSql();
  const rows = connectionId
    ? await sql<Record<string, unknown>>`
        select * from commerce_products
        where user_id = ${userId} and connection_id = ${connectionId}
        order by updated_at desc limit 200
      `
    : await sql<Record<string, unknown>>`
        select * from commerce_products where user_id = ${userId}
        order by updated_at desc limit 200
      `;
  return rows.map((r) => ({
    id: String(r.id),
    connection_id: String(r.connection_id),
    provider: String(r.provider),
    external_id: String(r.external_id),
    name: String(r.name),
    description: asString(r.description),
    slug: asString(r.slug),
    state: asString(r.state),
    access: asString(r.access),
    price_cents: r.price_cents == null ? null : Number(r.price_cents),
    currency: asString(r.currency),
    image_url: asString(r.image_url),
    variants: parseJson(asString(r.variants_json), []),
    source_media_id: asString(r.source_media_id),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}

export async function listOrders(userId: string, connectionId?: string): Promise<CommerceOrder[]> {
  const sql = await getSql();
  const rows = connectionId
    ? await sql<Record<string, unknown>>`
        select * from commerce_orders
        where user_id = ${userId} and connection_id = ${connectionId}
        order by created_at desc limit 200
      `
    : await sql<Record<string, unknown>>`
        select * from commerce_orders where user_id = ${userId}
        order by created_at desc limit 200
      `;
  return rows.map((r) => ({
    id: String(r.id),
    connection_id: String(r.connection_id),
    provider: String(r.provider),
    external_id: String(r.external_id),
    friendly_id: asString(r.friendly_id),
    status: asString(r.status),
    total_cents: r.total_cents == null ? null : Number(r.total_cents),
    currency: asString(r.currency),
    email: asString(r.email),
    items: parseJson(asString(r.items_json), []),
    tracking: parseJson(asString(r.tracking_json), {}),
    provider_created_at: asString(r.provider_created_at),
    created_at: String(r.created_at),
  }));
}

export async function recordProductFromCreation(input: {
  userId: string;
  connectionId: string;
  provider: string;
  productId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sourceMediaId: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into commerce_products (
      id, user_id, connection_id, provider, external_id, name, description,
      image_url, source_media_id, state, access, updated_at
    ) values (
      ${randomUUID()}, ${input.userId}, ${input.connectionId}, ${input.provider},
      ${input.productId}, ${input.name}, ${input.description}, ${input.imageUrl},
      ${input.sourceMediaId}, 'AVAILABLE', 'HIDDEN', now()
    )
    on conflict (connection_id, external_id) do update set
      name = excluded.name,
      description = excluded.description,
      image_url = coalesce(excluded.image_url, commerce_products.image_url),
      source_media_id = excluded.source_media_id,
      updated_at = now()
  `;
}

/**
 * Idempotency: the unique (provider, event_id) index makes a retried delivery a
 * no-op. Returns whether this delivery was a duplicate.
 */
export async function recordWebhookEvent(input: {
  userId: string | null;
  provider: string;
  eventId: string;
  type: string;
  payload: unknown;
}): Promise<{ duplicate: boolean }> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    insert into commerce_webhook_events (id, user_id, provider, event_id, type, payload_json)
    values (${randomUUID()}, ${input.userId}, ${input.provider}, ${input.eventId}, ${input.type},
            ${JSON.stringify(input.payload)})
    on conflict (provider, event_id) do nothing
    returning id
  `;
  return { duplicate: rows.length === 0 };
}

export async function markWebhookProcessed(provider: string, eventId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update commerce_webhook_events set processed = true
    where provider = ${provider} and event_id = ${eventId}
  `;
}

export async function listWebhookEvents(userId: string, limit = 50): Promise<WebhookEventRow[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, provider, event_id, type, received_at, processed
    from commerce_webhook_events
    where user_id = ${userId}
    order by received_at desc
    limit ${Math.min(200, Math.max(1, Math.trunc(limit)))}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    provider: String(r.provider),
    event_id: String(r.event_id),
    type: String(r.type),
    received_at: String(r.received_at),
    processed: Boolean(r.processed),
  }));
}

export async function recordCheckoutClick(input: {
  userId: string;
  connectionId: string | null;
  variantId: string | null;
  productName: string | null;
  pageId: string | null;
  utm: TrackingParams;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into commerce_checkout_clicks (id, user_id, connection_id, variant_id, product_name, page_id, utm_json)
    values (${randomUUID()}, ${input.userId}, ${input.connectionId}, ${input.variantId},
            ${input.productName}, ${input.pageId}, ${JSON.stringify(input.utm)})
  `;
}

export async function listCheckoutClicks(userId: string, limit = 50): Promise<CheckoutClickRow[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, variant_id, product_name, page_id, utm_json, created_at
    from commerce_checkout_clicks
    where user_id = ${userId}
    order by created_at desc
    limit ${Math.min(200, Math.max(1, Math.trunc(limit)))}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    variant_id: asString(r.variant_id),
    product_name: asString(r.product_name),
    page_id: asString(r.page_id),
    utm: parseJson(asString(r.utm_json), {}),
    created_at: String(r.created_at),
  }));
}

export async function listRecentPrintExports(userId: string, limit = 20) {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, method, print_width_in, print_height_in, dpi, target_width_px, target_height_px,
           source_width_px, source_height_px, verdict, warnings_json, byte_size, created_at
    from print_exports
    where user_id = ${userId}
    order by created_at desc
    limit ${Math.min(100, Math.max(1, Math.trunc(limit)))}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    method: String(r.method),
    print_width_in: Number(r.print_width_in),
    print_height_in: Number(r.print_height_in),
    dpi: Number(r.dpi),
    target_width_px: Number(r.target_width_px),
    target_height_px: Number(r.target_height_px),
    source_width_px: r.source_width_px == null ? null : Number(r.source_width_px),
    source_height_px: r.source_height_px == null ? null : Number(r.source_height_px),
    verdict: String(r.verdict),
    warnings: parseJson<string[]>(asString(r.warnings_json), []),
    byte_size: r.byte_size == null ? null : Number(r.byte_size),
    created_at: String(r.created_at),
  }));
}

export async function savePrintExport(input: {
  userId: string;
  mediaAssetId: string | null;
  method: string;
  printWidthIn: number;
  printHeightIn: number;
  dpi: number;
  targetWidthPx: number;
  targetHeightPx: number;
  sourceWidthPx: number | null;
  sourceHeightPx: number | null;
  verdict: string;
  warnings: string[];
  dataUrl: string;
  byteSize: number;
}): Promise<string> {
  const sql = await getSql();
  const id = randomUUID();
  await sql`
    insert into print_exports (
      id, user_id, media_asset_id, method, print_width_in, print_height_in, dpi,
      target_width_px, target_height_px, source_width_px, source_height_px,
      verdict, warnings_json, data_url, byte_size
    ) values (
      ${id}, ${input.userId}, ${input.mediaAssetId}, ${input.method},
      ${input.printWidthIn}, ${input.printHeightIn}, ${input.dpi},
      ${input.targetWidthPx}, ${input.targetHeightPx}, ${input.sourceWidthPx},
      ${input.sourceHeightPx}, ${input.verdict}, ${JSON.stringify(input.warnings)},
      ${input.dataUrl}, ${input.byteSize}
    )
  `;
  return id;
}

/** Store the Fourthwall webhook signing secret (encrypted, never returned). */
export async function saveWebhookSecret(
  userId: string,
  connectionId: string,
  secret: string,
): Promise<void> {
  const sql = await getSql();
  await sql`
    update commerce_connections
    set webhook_secret_enc = ${secret.trim() ? encryptSecret(secret.trim()) : null}, updated_at = now()
    where id = ${connectionId} and user_id = ${userId}
  `;
}

export async function hasWebhookSecret(userId: string, connectionId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ has: boolean }>`
    select (webhook_secret_enc is not null) as has
    from commerce_connections
    where id = ${connectionId} and user_id = ${userId}
  `;
  return Boolean(rows[0]?.has);
}

/** Every connection that has a webhook secret — used to authenticate an inbound delivery. */
export async function webhookCandidates(): Promise<
  Array<{ connectionId: string; userId: string; secret: string }>
> {
  const sql = await getSql();
  const rows = await sql<{ id: string; user_id: string; webhook_secret_enc: string | null }>`
    select id, user_id, webhook_secret_enc from commerce_connections
    where provider = 'fourthwall' and webhook_secret_enc is not null
  `;
  const out: Array<{ connectionId: string; userId: string; secret: string }> = [];
  for (const r of rows) {
    const secret = decryptSecret(r.webhook_secret_enc);
    if (secret) out.push({ connectionId: String(r.id), userId: String(r.user_id), secret });
  }
  return out;
}

/**
 * Public lookup for buy links: a checkout link is rendered on a public page, so
 * there is no session. Returns the shop domain + owner only — never credentials.
 */
export async function getConnectionPublic(
  connectionId: string,
): Promise<{ userId: string; shopDomain: string } | null> {
  const sql = await getSql();
  const rows = await sql<{ user_id: string; config_json: string | null }>`
    select user_id, config_json from commerce_connections
    where id = ${connectionId} and provider = 'fourthwall'
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  const config = parseJson<{ shopDomain?: string }>(asString(r.config_json), {});
  const shopDomain = (config.shopDomain ?? "").trim();
  if (!shopDomain) return null;
  return { userId: String(r.user_id), shopDomain };
}

