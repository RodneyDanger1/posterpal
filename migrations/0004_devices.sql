-- Paired devices (phone APK, Windows EXE, second browser) share this desk.

create table if not exists pairing_codes (
  code text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists pairing_codes_user_idx on pairing_codes (user_id, expires_at desc);

create table if not exists devices (
  id text primary key,
  user_id text not null,
  name text not null,
  platform text not null default 'web',
  token_hash text not null unique,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists devices_user_idx on devices (user_id, created_at desc);
create index if not exists devices_token_idx on devices (token_hash);
