-- ------------------------------------------------------------
-- 007_github_connections.sql
--
-- GitHub import/push never worked from a migrations-only database: this table
-- was defined solely in the outdated `supabase/schema.sql`, so every token
-- write failed and every read returned "not connected" with no error shown.
--
-- Safe to re-run.
-- ------------------------------------------------------------

create table if not exists public.github_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  github_login text,
  -- AES-256-GCM ciphertext written by lib/crypto.ts: iv.tag.ciphertext, base64.
  -- Rows written before encryption was added hold a raw token; the reader
  -- detects and transparently upgrades those.
  access_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.github_connections enable row level security;

-- No client policies on purpose. A browser session must never be able to read
-- a stored OAuth token, so every read/write goes through the service role
-- inside a route handler. DELETE /api/github runs server-side too.

create index if not exists github_connections_updated_at_idx
  on public.github_connections (updated_at desc);
