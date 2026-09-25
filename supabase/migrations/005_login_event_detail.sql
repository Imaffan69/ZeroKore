-- ------------------------------------------------------------
-- 005 — login_events.detail
--
-- The activity log gained device, region, coordinates, timezone, ASN and
-- network enrichment. It was written by the app before this column existed,
-- so every insert failed on an unknown column: sign-in recording was silently
-- dead and the admin Security tab had nothing to show.
--
-- jsonb so the shape can grow without another migration. Safe to re-run.
-- ------------------------------------------------------------
alter table public.login_events
  add column if not exists detail jsonb;
