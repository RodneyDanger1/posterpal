-- Operator agent runs. Drafts only — never a Graph publish.

create table if not exists agent_runs (
  id text primary key,
  user_id text not null,
  page_id text,
  prompt text not null,
  summary text,
  drafts_json text,
  sources_json text,
  image_prompt text,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_user_idx on agent_runs (user_id, created_at desc);
