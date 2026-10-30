/**
 * Normalized commerce types. Providers map into these; the UI/DB never see a
 * provider's raw JSON shape.
 *
 * Rule of thumb (matches the rest of PosterPal): a provider call either returns
 * this shape or throws CommerceError with the provider's own code attached.
 * Nothing here fabricates a "connected" state — unverified is unverified.
 */

export const COMMERCE_PROVIDERS = ["fourthwall"] as const;
export type CommerceProviderId = (typeof COMMERCE_PROVIDERS)[number];

export type ConnectionStatus = "unverified" | "connected" | "error";

export type CommerceConnectionRow = {
  id: string;
  user_id: string;
  provider: string;
  label: string;
  status: ConnectionStatus;
  account_ref: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  has_credentials: boolean;
  config: Record<string, string>;
};

export type CommerceVariant = {
  id: string;
  name: string;
  sku: string | null;
  price_cents: number | null;
  compare_at_cents: number | null;
  color: string | null;
  size: string | null;
  in_stock: boolean | null;
};

export type CommerceProduct = {
  id: string;
  connection_id: string;
  provider: string;
  external_id: string;
  name: string;
  description: string | null;
  slug: string | null;
  state: string | null;
  access: string | null;
  price_cents: number | null;
  currency: string | null;
  image_url: string | null;
  variants: CommerceVariant[];
  source_media_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CommerceOrderItem = {
  external_product_id: string;
  name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price_cents: number | null;
};

export type CommerceOrder = {
  id: string;
  connection_id: string;
  provider: string;
  external_id: string;
  friendly_id: string | null;
  status: string | null;
  total_cents: number | null;
  currency: string | null;
  email: string | null;
  items: CommerceOrderItem[];
  tracking: Record<string, string>;
  provider_created_at: string | null;
  created_at: string;
};

export type ProductTemplate = {
  id: string;
  name: string;
  category: string;
  brand: string;
  base_price_cents: number | null;
  currency: string | null;
  production_method: string;
  supports_backend_rendering: boolean;
  thumbnail_url: string | null;
};

export type WebhookEventRow = {
  id: string;
  provider: string;
  event_id: string;
  type: string;
  received_at: string;
  processed: boolean;
};

export type CheckoutClickRow = {
  id: string;
  variant_id: string | null;
  product_name: string | null;
  page_id: string | null;
  utm: Record<string, string>;
  created_at: string;
};

/** Thrown by every provider client. `code` is the provider's own error code when present. */
export class CommerceError extends Error {
  readonly provider: CommerceProviderId;
  readonly status: number | null;
  readonly code: string | null;

  constructor(
    provider: CommerceProviderId,
    message: string,
    opts: { status?: number | null; code?: string | null } = {},
  ) {
    super(message);
    this.name = "CommerceError";
    this.provider = provider;
    this.status = opts.status ?? null;
    this.code = opts.code ?? null;
  }
}

/** Convert a provider Money object (or bare number) to integer cents. */
export function moneyToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (value && typeof value === "object") {
    const amount = (value as { amount?: unknown; value?: unknown }).amount;
    const alt = (value as { value?: unknown }).value;
    const raw = typeof amount === "number" ? amount : typeof alt === "number" ? alt : null;
    if (raw !== null && Number.isFinite(raw)) return Math.round(raw * 100);
  }
  return null;
}

export function currencyOf(value: unknown): string | null {
  if (value && typeof value === "object") {
    const c = (value as { currency?: unknown }).currency;
    if (typeof c === "string" && c.trim()) return c.trim().toUpperCase();
  }
  return null;
}
