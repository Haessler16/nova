-- Additive operational search support: accent-insensitive matching for guest
-- names. Prisma scopes `search_path` to the tenant schema, so the extension is
-- pinned to `public` and callers use `public.unaccent(...)`. Reversible with
-- `DROP EXTENSION IF EXISTS unaccent;` if no other object depends on it.
-- No table or column is altered.
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER EXTENSION unaccent SET SCHEMA public;
