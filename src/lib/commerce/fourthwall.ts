/**
 * Fourthwall Platform Open API client (server-only).
 *
 * Verified against the official docs (docs.fourthwall.com, fetched 2026-10-29):
 *   base   https://api.fourthwall.com/open-api/v1.0
 *   auth   HTTP Basic — Open API username + password from
 *          Settings > For developers > Open API (NOT a bearer token)
 *   scopes offer_read/offer_write, media_write, order_read, webhook_read
 *
 * Product creation is a 5-step pipeline and every step is reproduced exactly:
 *   1. GET  /product-templates/page/{page}      (public, no auth)
 *   2. POST /media/upload-url                   {fileName, contentType, size}
 *   3. PUT  {uploadUrl}                         raw bytes + x-goog-content-length-range: 0,{size}
 *   4. POST /media/images                       {fileUrl, width, height} -> id (imageId)
 *   5. POST /products                           {type:"design", productTemplateId, regions:[{region,imageId}]}
 *
 * Checkout is Fourthwall-hosted (they are Merchant of Record). The only on-site
 * handoff available is the documented /cart/checkout redirect endpoint; that is
 * what buildCheckoutUrl() produces. It is NOT a custom checkout and this module
 * never claims otherwise.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CommerceError,
  currencyOf,
  moneyToCents,
  type CommerceOrder,
  type CommerceOrderItem,
  type CommerceProduct,
  type CommerceVariant,
  type ProductTemplate,
} from "./types";

export const FOURTHWALL_API_BASE = "https://api.fourthwall.com/open-api/v1.0";
export const FOURTHWALL_STOREFRONT_BASE = "https://storefront-api.fourthwall.com/v1";
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 25 * 1024 * 1024;

export type FourthwallCredentials = {
  username: string;
  password: string;
};

export type FourthwallConfig = {
  /** Shop domain used to build customer-facing checkout links (publicDomain wins). */
  shopDomain?: string;
};

export type FourthwallShop = {
  id: string;
  name: string;
  domain: string;
  publicDomain: string;
  status: string;
};

type RawProduct = {
  id?: string;
  name?: string;
  description?: string;
  slug?: string;
  state?: { type?: string };
  access?: { type?: string };
  images?: Array<{ url?: string; transformedUrl?: string }>;
  thumbnailImage?: { url?: string; transformedUrl?: string };
  variants?: Array<{
    id?: string;
    name?: string;
    sku?: string;
    unitPrice?: { value?: number; currency?: string };
    compareAtPrice?: { value?: number; currency?: string };
    attributes?: { description?: string; color?: { name?: string }; size?: { name?: string } };
    stock?: { type?: string; inStock?: number };
  }>;
};

type RawOrder = {
  id?: string;
  friendlyId?: string;
  status?: string;
  email?: string;
  amounts?: { total?: { value?: number; currency?: string } };
  offers?: Array<{
    id?: string;
    name?: string;
    variant?: {
      id?: string;
      name?: string;
      quantity?: number;
      unitPrice?: { value?: number; currency?: string };
    };
  }>;
  trackingParams?: Record<string, string>;
  createdAt?: string;
};

function basicAuth(creds: FourthwallCredentials): string {
  const raw = `${creds.username}:${creds.password}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

async function readError(res: Response): Promise<{ code: string | null; message: string }> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { code?: string; title?: string; message?: string };
    const code = typeof body.code === "string" ? body.code : null;
    const message = body.title || body.message || code || `HTTP ${res.status}`;
    return { code, message };
  } catch {
    return { code: null, message: text.slice(0, 220) || `HTTP ${res.status}` };
  }
}

export class FourthwallClient {
  private readonly creds: FourthwallCredentials;
  private readonly base: string;

  constructor(creds: FourthwallCredentials, base = FOURTHWALL_API_BASE) {
    if (!creds.username.trim() || !creds.password.trim()) {
      throw new CommerceError("fourthwall", "Fourthwall Open API username and password are required.");
    }
    this.creds = creds;
    this.base = trimBase(base);
  }

  private async request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
    const auth = init.auth !== false;
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers ?? {}),
          ...(auth ? { Authorization: basicAuth(this.creds) } : {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network failure";
      throw new CommerceError("fourthwall", `Fourthwall request failed: ${msg}`);
    }
    if (!res.ok) {
      const { code, message } = await readError(res);
      throw new CommerceError("fourthwall", `Fourthwall ${res.status} ${code ? `(${code}) ` : ""}${message}`, {
        status: res.status,
        code,
      });
    }
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  async getShop(): Promise<FourthwallShop> {
    const raw = await this.request<Partial<FourthwallShop>>("/shops/current");
    if (!raw.id) throw new CommerceError("fourthwall", "Fourthwall returned a shop without an id.");
    return {
      id: String(raw.id),
      name: String(raw.name ?? ""),
      domain: String(raw.domain ?? ""),
      publicDomain: String(raw.publicDomain ?? ""),
      status: String(raw.status ?? ""),
    };
  }

  /** Public endpoint — no credentials needed, but keeping it on the client is simpler. */
  async listTemplates(page = 1): Promise<{ results: ProductTemplate[]; total: number }> {
    const safePage = Math.max(1, Math.trunc(page));
    const raw = await this.request<{
      results?: Array<{
        productId?: string;
        name?: string;
        category?: string;
        brand?: string;
        thumbnail?: string;
        basePrice?: { amount?: number; currency?: string };
        productionMethod?: string;
        supportsBackendRendering?: boolean;
      }>;
      total?: number;
    }>(`/product-templates/page/${safePage}`, { auth: false });
    const results = (raw.results ?? []).map((t) => ({
      id: String(t.productId ?? ""),
      name: String(t.name ?? ""),
      category: String(t.category ?? ""),
      brand: String(t.brand ?? ""),
      base_price_cents: moneyToCents(t.basePrice),
      currency: currencyOf(t.basePrice),
      production_method: String(t.productionMethod ?? ""),
      supports_backend_rendering: Boolean(t.supportsBackendRendering),
      thumbnail_url: typeof t.thumbnail === "string" ? t.thumbnail : null,
    }));
    return { results, total: Number(raw.total ?? results.length) };
  }

  async listProducts(opts: { page?: number; size?: number; search?: string } = {}): Promise<{
    results: CommerceProduct[];
    total: number;
  }> {
    const params = new URLSearchParams();
    params.set("page", String(Math.max(0, Math.trunc(opts.page ?? 0))));
    params.set("size", String(Math.min(100, Math.max(1, Math.trunc(opts.size ?? 50)))));
    if (opts.search?.trim()) params.set("search", opts.search.trim());
    const raw = await this.request<{ results?: RawProduct[]; total?: number }>(`/products?${params}`);
    const results = (raw.results ?? []).map((p) => normalizeProduct(p));
    return { results, total: Number(raw.total ?? results.length) };
  }

  async listOrders(opts: { page?: number; size?: number } = {}): Promise<{
    results: CommerceOrder[];
    total: number;
  }> {
    const params = new URLSearchParams();
    params.set("page", String(Math.max(0, Math.trunc(opts.page ?? 0))));
    params.set("size", String(Math.min(100, Math.max(1, Math.trunc(opts.size ?? 25)))));
    const raw = await this.request<{ results?: RawOrder[]; total?: number }>(`/order?${params}`);
    const results = (raw.results ?? []).map((o) => normalizeOrder(o));
    return { results, total: Number(raw.total ?? results.length) };
  }

  /**
   * Full design-product pipeline: upload bytes -> register media image -> create
   * design product. Returns the created product id plus the Fourthwall render.
   */
  async createDesignProductFromImage(input: {
    bytes: Buffer;
    fileName: string;
    contentType: string;
    width: number;
    height: number;
    productTemplateId: string;
    name: string;
    description?: string;
    regions?: string[];
    colors?: string[];
    sizes?: string[];
    profitMargin?: number;
    publishOnCreate?: boolean;
    placementStrategy?: "AUTO" | "FILL_ALL" | "FULL_REGION" | "PLACEMENT_ID";
  }): Promise<{ productId: string; customizationId: string | null; images: Array<{ url: string; region: string | null }>; imageId: string }> {
    if (input.bytes.byteLength === 0) throw new CommerceError("fourthwall", "Design image is empty.");
    if (input.bytes.byteLength > MAX_BYTES) {
      throw new CommerceError("fourthwall", "Design image is larger than the 25MB safety cap.");
    }
    if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < 1 || input.height < 1) {
      throw new CommerceError("fourthwall", "Design image dimensions must be positive integers.");
    }

    const upload = await this.request<{ uploadUrl?: string; fileUrl?: string }>("/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.bytes.byteLength,
      }),
    });
    if (!upload.uploadUrl || !upload.fileUrl) {
      throw new CommerceError("fourthwall", "Fourthwall did not return an upload URL.");
    }

    // GCS pre-signed PUT: the signed conditions are the exact Content-Type and
    // the exact byte length. Do NOT send Fourthwall credentials to this host.
    let putRes: Response;
    try {
      putRes = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": input.contentType,
          "x-goog-content-length-range": `0,${input.bytes.byteLength}`,
        },
        body: new Uint8Array(input.bytes),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network failure";
      throw new CommerceError("fourthwall", `Fourthwall image upload failed: ${msg}`);
    }
    if (!putRes.ok) {
      const body = await putRes.text().catch(() => "");
      throw new CommerceError(
        "fourthwall",
        `Fourthwall image upload rejected (${putRes.status}): ${body.slice(0, 200)}`,
        { status: putRes.status },
      );
    }

    const media = await this.request<{ id?: string }>("/media/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: upload.fileUrl,
        width: Math.round(input.width),
        height: Math.round(input.height),
      }),
    });
    const imageId = media.id;
    if (!imageId) throw new CommerceError("fourthwall", "Fourthwall media library did not return an image id.");

    const regions = (input.regions?.length ? input.regions : ["front"]).map((region) => ({
      region,
      imageId,
      placementStrategy: input.placementStrategy ?? "AUTO",
    }));

    const created = await this.request<{
      productId?: string;
      customizationId?: string;
      images?: Array<{ url?: string; region?: string }>;
    }>("/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "design",
        productTemplateId: input.productTemplateId,
        name: input.name,
        description: input.description ?? "",
        regions,
        ...(input.colors?.length ? { colors: input.colors } : {}),
        ...(input.sizes?.length ? { sizes: input.sizes } : {}),
        ...(typeof input.profitMargin === "number" ? { profitMargin: input.profitMargin } : {}),
        publishOnCreate: input.publishOnCreate ?? false,
      }),
    });
    if (!created.productId) throw new CommerceError("fourthwall", "Fourthwall did not return a product id.");
    return {
      productId: created.productId,
      customizationId: created.customizationId ?? null,
      images: (created.images ?? [])
        .filter((i): i is { url: string; region?: string } => typeof i.url === "string")
        .map((i) => ({ url: i.url, region: typeof i.region === "string" ? i.region : null })),
      imageId,
    };
  }
}

/**
 * Product templates are public ("This endpoint is public and does not require
 * authentication"), so the catalogue can be browsed before a connection exists.
 */
export async function fetchProductTemplates(page = 1): Promise<{
  results: ProductTemplate[];
  total: number;
}> {
  const safePage = Math.max(1, Math.trunc(page));
  let res: Response;
  try {
    res = await fetch(`${FOURTHWALL_API_BASE}/product-templates/page/${safePage}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new CommerceError(
      "fourthwall",
      `Could not reach Fourthwall: ${e instanceof Error ? e.message : "network failure"}`,
    );
  }
  if (!res.ok) {
    const { code, message } = await readError(res);
    throw new CommerceError("fourthwall", `Fourthwall templates ${res.status} ${code ? `(${code}) ` : ""}${message}`, {
      status: res.status,
      code,
    });
  }
  const raw = (await res.json()) as {
    results?: Array<{
      productId?: string;
      name?: string;
      category?: string;
      brand?: string;
      thumbnail?: string;
      basePrice?: { amount?: number; currency?: string };
      productionMethod?: string;
      supportsBackendRendering?: boolean;
    }>;
    total?: number;
  };
  const results = (raw.results ?? []).map((t) => ({
    id: String(t.productId ?? ""),
    name: String(t.name ?? ""),
    category: String(t.category ?? ""),
    brand: String(t.brand ?? ""),
    base_price_cents: moneyToCents(t.basePrice),
    currency: currencyOf(t.basePrice),
    production_method: String(t.productionMethod ?? ""),
    supports_backend_rendering: Boolean(t.supportsBackendRendering),
    thumbnail_url: typeof t.thumbnail === "string" ? t.thumbnail : null,
  }));
  return { results, total: Number(raw.total ?? results.length) };
}

export function normalizeProduct(p: RawProduct): CommerceProduct {
  const image =
    p.thumbnailImage?.transformedUrl ||
    p.thumbnailImage?.url ||
    p.images?.[0]?.transformedUrl ||
    p.images?.[0]?.url ||
    null;
  const variants: CommerceVariant[] = (p.variants ?? []).map((v) => {
    const stock = v.stock as { type?: string; inStock?: number } | undefined;
    return {
      id: String(v.id ?? ""),
      name: String(v.name ?? ""),
      sku: typeof v.sku === "string" && v.sku ? v.sku : null,
      price_cents: moneyToCents(v.unitPrice),
      compare_at_cents: moneyToCents(v.compareAtPrice),
      color: v.attributes?.color?.name ?? null,
      size: v.attributes?.size?.name ?? null,
      in_stock: stock ? stock.type !== "LIMITED" || (stock.inStock ?? 0) > 0 : null,
    };
  });
  const cheapest = variants
    .map((v) => v.price_cents)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b)[0];
  return {
    id: String(p.id ?? ""),
    connection_id: "",
    provider: "fourthwall",
    external_id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    description: typeof p.description === "string" ? p.description : null,
    slug: typeof p.slug === "string" ? p.slug : null,
    state: p.state?.type ?? null,
    access: p.access?.type ?? null,
    price_cents: cheapest ?? null,
    currency: currencyOf(p.variants?.[0]?.unitPrice) ?? currencyOf(p.images?.[0]),
    image_url: image,
    variants,
    source_media_id: null,
    created_at: "",
    updated_at: "",
  };
}

export function normalizeOrder(o: RawOrder): CommerceOrder {
  const items: CommerceOrderItem[] = (o.offers ?? []).map((offer) => ({
    external_product_id: String(offer.id ?? ""),
    name: String(offer.name ?? ""),
    variant_id: offer.variant?.id ? String(offer.variant.id) : null,
    variant_name: offer.variant?.name ? String(offer.variant.name) : null,
    quantity: Math.max(1, Math.trunc(Number(offer.variant?.quantity ?? 1))),
    unit_price_cents: moneyToCents(offer.variant?.unitPrice),
  }));
  return {
    id: "",
    connection_id: "",
    provider: "fourthwall",
    external_id: String(o.id ?? ""),
    friendly_id: o.friendlyId ? String(o.friendlyId) : null,
    status: o.status ? String(o.status) : null,
    total_cents: moneyToCents(o.amounts?.total),
    currency: currencyOf(o.amounts?.total),
    email: o.email ? String(o.email) : null,
    items,
    tracking: o.trackingParams ?? {},
    provider_created_at: o.createdAt ? String(o.createdAt) : null,
    created_at: "",
  };
}

/**
 * Fourthwall webhook verification.
 * Header: X-Fourthwall-Hmac-SHA256 (platform apps: X-Fourthwall-Hmac-Apps-SHA256)
 * Value:  base64(HMAC-SHA256(secret, rawRequestBody))
 * Comparison is timing-safe.
 */
export function verifyFourthwallSignature(
  rawBody: Buffer | Uint8Array,
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const digest = createHmac("sha256", secret).update(body).digest();
  const expected = Buffer.from(digest.toString("base64"), "utf8");
  const provided = Buffer.from(header.trim(), "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** Merchant-facing marketing params Fourthwall captures and propagates into checkout metadata. */
export const FOURTHWALL_TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "_fbp",
  "_fbc",
  "FPID",
] as const;

export type TrackingParams = Partial<Record<(typeof FOURTHWALL_TRACKING_KEYS)[number], string>>;

/**
 * Build the documented Fourthwall checkout redirect:
 *   GET https://{shop_domain}/cart/checkout?products=variantId[:qty]&...
 *
 * This is the one supported way to put a buy button on your own page: the
 * customer browses on your site and only the payment step moves to Fourthwall.
 * Fourthwall is the Merchant of Record — there is no on-domain checkout to call.
 */
export function buildCheckoutUrl(input: {
  shopDomain: string;
  items: Array<{ variantId: string; quantity?: number }>;
  currency?: string;
  coupon?: string;
  tracking?: TrackingParams;
}): string {
  const domain = input.shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!domain) throw new CommerceError("fourthwall", "Fourthwall shop domain is required for checkout links.");
  if (input.items.length === 0) throw new CommerceError("fourthwall", "A checkout link needs at least one variant.");
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const item of input.items) {
    if (!UUID.test(item.variantId)) {
      throw new CommerceError("fourthwall", `"${item.variantId}" is not a Fourthwall variant UUID.`);
    }
  }
  const products = input.items
    .map((item) => {
      const qty = Number.isFinite(item.quantity) ? Math.max(1, Math.trunc(item.quantity as number)) : 1;
      return `${item.variantId}:${qty}`;
    })
    .join(",");
  const url = new URL(`https://${domain}/cart/checkout`);
  url.searchParams.set("products", products);
  if (input.currency?.trim()) url.searchParams.set("currency", input.currency.trim().toUpperCase());
  if (input.coupon?.trim()) url.searchParams.set("coupon", input.coupon.trim());
  for (const key of FOURTHWALL_TRACKING_KEYS) {
    const value = input.tracking?.[key];
    if (value && value.trim()) url.searchParams.set(key, value.trim());
  }
  return url.toString();
}

/** Parse the webhook envelope. `data` stays raw — each event type owns its shape. */
export function parseFourthwallWebhook(raw: unknown): {
  id: string;
  type: string;
  shopId: string | null;
  testMode: boolean;
  data: Record<string, unknown>;
} {
  if (!raw || typeof raw !== "object") {
    throw new CommerceError("fourthwall", "Fourthwall webhook body is not a JSON object.");
  }
  const body = raw as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!id || !type) throw new CommerceError("fourthwall", "Fourthwall webhook is missing id or type.");
  return {
    id,
    type,
    shopId: typeof body.shopId === "string" ? body.shopId : null,
    testMode: body.testMode === true,
    data:
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {},
  };
}
