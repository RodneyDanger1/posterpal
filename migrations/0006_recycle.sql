-- Post recycling: when set on a Published post, the worker drafts a recycle
-- copy once the post is older than this many days. The copy is a LocalDraft —
-- a human approves and schedules it. Identical drafts are never duplicated,
-- so recycling can never spam the queue.
alter table posts add column if not exists recycle_after_days integer;
