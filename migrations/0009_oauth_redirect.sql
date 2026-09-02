-- Store the exact redirect_uri used in the OAuth dialog so token exchange
-- uses the same string (Facebook requires a byte-for-byte match).
alter table oauth_states add column if not exists redirect_uri text;
