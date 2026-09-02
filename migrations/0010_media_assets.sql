-- Generated/uploaded stills that must survive Composer navigation and APK sessions.
-- Not tied to a post until the operator actually publishes.
create table if not exists media_assets (
  id text primary key,
  user_id text not null,
  page_id text,
  file_name text not null,
  mime_type text,
  media_kind text not null default 'Photo',
  alt_text text,
  data_url text,
  prompt text,
  provider text,
  created_with_ai boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists media_assets_user_idx on media_assets (user_id, created_at desc);
