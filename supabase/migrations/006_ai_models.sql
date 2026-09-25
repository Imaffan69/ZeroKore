-- ------------------------------------------------------------
-- 006 — ai_models: admin-managed model registry
--
-- Lets an admin add a model by typing its name and the NAME OF THE ENV VAR that
-- holds its key. The key itself is never stored here or sent from the browser:
-- it stays in the deployment's environment, exactly like the built-in providers.
-- That means adding a model is a two-step action by design — set the env var,
-- then register the model — and the panel refuses to register a model whose env
-- var is not actually present, so the picker can never show a dead entry.
-- ------------------------------------------------------------
create table if not exists public.ai_models (
  id text primary key,
  label text not null,
  -- 'openai' for any OpenAI-compatible endpoint, 'gemini' for generateContent.
  kind text not null default 'openai' check (kind in ('openai', 'gemini')),
  -- The provider whose credentials are reused (openrouter | groq | deepseek | ...).
  upstream text not null default 'openrouter',
  base_url text,
  -- NAME of the environment variable holding the key. Never the key itself.
  api_key_env text not null,
  group_label text,
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.ai_models enable row level security;

-- Read-only for signed-in users: the model picker needs the list.
drop policy if exists "ai_models_read_authed" on public.ai_models;
create policy "ai_models_read_authed" on public.ai_models
  for select to authenticated using (true);

-- Writes go through the service client in /api/admin/models (which checks the
-- staff rank server-side), so no client-side insert/update policy is granted.
