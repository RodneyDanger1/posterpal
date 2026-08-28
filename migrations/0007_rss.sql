-- RSS auto-post: when a Page has a feed URL, the worker drafts new items from
-- it (human approves — never auto-published). Duplicate captions are skipped
-- by the same dedup check recycling uses.
alter table pages add column if not exists rss_feed_url text;
