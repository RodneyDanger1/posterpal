-- Operator-visible desk log. Failures from Graph, the worker, the UI, and
-- pairing land here so nothing is silent. Pruned in application code.
create table if not exists desk_logs (
  id text primary key,
  user_id text,
  level text not null,
  scope text not null,
  message text not null,
  extra text,
  created_at timestamptz not null default now()
);
create index if not exists desk_logs_user_time_idx on desk_logs (user_id, created_at desc);
create index if not exists desk_logs_time_idx on desk_logs (created_at desc);
