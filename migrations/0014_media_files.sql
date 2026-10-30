-- Media bytes move out of the database onto disk (see src/lib/posterpal/media-files.ts).
-- `data_url` stays for legacy rows and as the fallback when no writable media dir
-- exists (e.g. a serverless host with a read-only filesystem).

alter table content_items add column if not exists file_path text;

alter table media_assets add column if not exists file_path text;
alter table media_assets add column if not exists byte_size integer;
alter table media_assets add column if not exists sha256 text;
