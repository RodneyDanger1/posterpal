-- Commerce connectors (Fourthwall first; provider column keeps the door open).
-- Credentials are AES-GCM ciphertext (src/lib/posterpal/crypto.ts), never plaintext.
-- Nothing here stores card data, customer payment details, or Facebook tokens.

create table if not exists commerce_connections (
  id text primary key,
  user_id text not null,
  provider text not null,
  label text not null,
  credentials_enc text,
  webhook_secret_enc text,
  config_json text,
  status text not null default 'unverified',
  account_ref text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, label)
);
create index if not exists commerce_connections_user_idx on commerce_connections (user_id);

create table if not exists commerce_products (
  id text primary key,
  user_id text not null,
  connection_id text not null references commerce_connections (id) on delete cascade,
  provider text not null,
  external_id text not null,
  name text not null,
  description text,
  slug text,
  state text,
  access text,
  price_cents integer,
  currency text,
  image_url text,
  variants_json text,
  source_media_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
create index if not exists commerce_products_user_idx on commerce_products (user_id, updated_at desc);

create table if not exists commerce_orders (
  id text primary key,
  user_id text not null,
  connection_id text not null references commerce_connections (id) on delete cascade,
  provider text not null,
  external_id text not null,
  friendly_id text,
  status text,
  total_cents integer,
  currency text,
  email text,
  items_json text,
  tracking_json text,
  provider_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
create index if not exists commerce_orders_user_idx on commerce_orders (user_id, created_at desc);

-- Webhook delivery log. The unique (provider, event_id) index is the idempotency
-- guarantee: a retried delivery cannot double-process an order.
create table if not exists commerce_webhook_events (
  id text primary key,
  user_id text,
  provider text not null,
  event_id text not null,
  type text not null,
  payload_json text not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  unique (provider, event_id)
);
create index if not exists commerce_webhook_events_received_idx on commerce_webhook_events (received_at desc);

-- Buy-link click log: proves which Page/post drove a handoff to Fourthwall checkout,
-- so attribution survives the redirect off-site.
create table if not exists commerce_checkout_clicks (
  id text primary key,
  user_id text not null,
  connection_id text,
  variant_id text,
  product_name text,
  page_id text,
  utm_json text,
  created_at timestamptz not null default now()
);
create index if not exists commerce_checkout_clicks_user_idx on commerce_checkout_clicks (user_id, created_at desc);

-- Print-ready exports produced by the sharp pipeline. The pixel math and warnings
-- are stored so an operator can audit why an asset was accepted or upscaled.
create table if not exists print_exports (
  id text primary key,
  user_id text not null,
  media_asset_id text,
  method text not null,
  print_width_in double precision not null,
  print_height_in double precision not null,
  dpi integer not null,
  target_width_px integer not null,
  target_height_px integer not null,
  source_width_px integer,
  source_height_px integer,
  verdict text not null,
  warnings_json text,
  data_url text,
  byte_size integer,
  created_at timestamptz not null default now()
);
create index if not exists print_exports_user_idx on print_exports (user_id, created_at desc);
