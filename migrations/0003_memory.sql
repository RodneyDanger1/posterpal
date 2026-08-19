-- Saved ideas (Later board) and reusable caption snippets.

create table if not exists saved_ideas (
  id text primary key,
  user_id text not null,
  page_id text references pages (id) on delete set null,
  title text not null default '',
  body text not null default '',
  media_type text not null default 'Text',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists saved_ideas_user_idx on saved_ideas (user_id, created_at desc);

create table if not exists caption_snippets (
  id text primary key,
  user_id text not null,
  page_id text,
  label text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists caption_snippets_user_idx on caption_snippets (user_id, created_at desc);
