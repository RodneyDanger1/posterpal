-- PosterPal CRM schema. All per-user tables carry user_id TEXT.

create table if not exists app_settings (
  user_id text not null,
  key text not null,
  value_enc text,
  value_plain text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists token_vault (
  id text primary key,
  user_id text not null,
  name text not null,
  user_token_enc text,
  long_lived_token_enc text,
  expires_at timestamptz,
  data_access_expires_at timestamptz,
  scopes text,
  last_validated_at timestamptz,
  is_valid boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists token_vault_user_idx on token_vault (user_id);

create table if not exists pages (
  id text primary key,
  user_id text not null,
  facebook_page_id text,
  name text not null,
  category text,
  fan_count integer not null default 0,
  tasks_json text,
  access_token_enc text,
  is_active boolean not null default true,
  is_read_only boolean not null default false,
  is_practice boolean not null default false,
  ai_provider text,
  ai_model text,
  brand_voice text,
  cadence_warn_per_24h integer not null default 8,
  cadence_block_per_24h integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pages_user_fb_idx on pages (user_id, facebook_page_id)
  where facebook_page_id is not null;
create index if not exists pages_user_idx on pages (user_id);

create table if not exists posts (
  id text primary key,
  user_id text not null,
  page_id text not null references pages (id) on delete cascade,
  facebook_post_id text,
  message text,
  link text,
  first_comment text,
  media_type text not null default 'Text',
  status text not null default 'LocalDraft',
  scheduled_publish_time timestamptz,
  published_time timestamptz,
  created_by_this_app boolean not null default true,
  ai_variant_label text,
  variant_group_id text,
  engagement_score double precision,
  reactions_count integer not null default 0,
  comments_count integer not null default 0,
  shares_count integer not null default 0,
  media_view_unique integer,
  last_insights_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_page_created_idx on posts (page_id, created_at desc);
create index if not exists posts_status_sched_idx on posts (status, scheduled_publish_time);
create index if not exists posts_user_idx on posts (user_id);
create index if not exists posts_fb_idx on posts (facebook_post_id);

create table if not exists content_items (
  id text primary key,
  user_id text not null,
  post_id text not null references posts (id) on delete cascade,
  file_name text not null,
  mime_type text,
  media_kind text not null default 'Photo',
  file_size integer,
  width integer,
  height integer,
  duration_ms integer,
  alt_text text,
  data_url text,
  sort_order integer not null default 0,
  created_with_ai boolean not null default false,
  sha256 text,
  created_at timestamptz not null default now()
);
create index if not exists content_items_post_idx on content_items (post_id);

create table if not exists merchandise_links (
  id text primary key,
  user_id text not null,
  page_id text not null references pages (id) on delete cascade,
  title text not null,
  url text not null,
  platform text,
  utm_template text,
  cta_override text,
  created_at timestamptz not null default now()
);
create index if not exists merch_page_idx on merchandise_links (page_id);

create table if not exists comments (
  id text primary key,
  user_id text not null,
  facebook_comment_id text,
  post_id text not null references posts (id) on delete cascade,
  message text not null,
  author_name text,
  author_id text,
  sentiment text,
  needs_reply boolean not null default false,
  reply_drafts_json text,
  is_hidden boolean not null default false,
  is_from_page boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists comments_fb_idx on comments (user_id, facebook_comment_id)
  where facebook_comment_id is not null;
create index if not exists comments_post_idx on comments (post_id);

create table if not exists scheduler_logs (
  id text primary key,
  user_id text not null,
  post_id text,
  attempt_time timestamptz not null default now(),
  status text not null,
  error_message text,
  graph_error_code integer,
  http_status_code integer,
  duration_ms integer,
  request_path text
);
create index if not exists scheduler_logs_post_idx on scheduler_logs (post_id);

create table if not exists quota_snapshots (
  id text primary key,
  user_id text not null,
  page_id text,
  source_header text,
  call_count_pct double precision,
  estimated_regain_minutes integer,
  captured_at timestamptz not null default now()
);
create index if not exists quota_user_idx on quota_snapshots (user_id, captured_at desc);

create table if not exists oauth_states (
  state text primary key,
  user_id text not null,
  expires_at timestamptz not null
);
