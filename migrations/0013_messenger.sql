-- Facebook Page Messenger (HITL only). One thread per Page-scoped PSID.
-- The 24-hour standard messaging window is enforced in code, not in the schema.

create table if not exists messenger_threads (
  id text primary key,
  user_id text not null,
  page_id text not null references pages (id) on delete cascade,
  psid text not null,
  display_name text,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  needs_reply boolean not null default true,
  created_at timestamptz not null default now(),
  unique (page_id, psid)
);
create index if not exists messenger_threads_user_idx on messenger_threads (user_id, last_message_at desc);

create table if not exists messenger_messages (
  id text primary key,
  user_id text not null,
  thread_id text not null references messenger_threads (id) on delete cascade,
  mid text,
  direction text not null,
  body text,
  attachments_json text,
  sent_at timestamptz,
  is_echo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists messenger_messages_mid_idx on messenger_messages (mid) where mid is not null;
create index if not exists messenger_messages_thread_idx on messenger_messages (thread_id, created_at asc);
