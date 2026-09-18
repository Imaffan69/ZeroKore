-- ============================================================
-- ZeroKore database schema
-- Run in the Supabase SQL editor (or via supabase db push).
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ------------------------------------------------------------
-- profiles: one row per auth user. Role defaults to 'user'.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- user_usage: daily AI request counter per user.
-- ------------------------------------------------------------
create table if not exists public.user_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requests_today integer not null default 0,
  last_request_date date not null default (now() at time zone 'utc')::date
);

-- ------------------------------------------------------------
-- agent_memory: long-term user-scoped vector memory.
-- ------------------------------------------------------------
create table if not exists public.agent_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists agent_memory_user_idx on public.agent_memory (user_id);
-- Cosine-similarity index for pgvector recall
create index if not exists agent_memory_embedding_idx
  on public.agent_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ------------------------------------------------------------
-- conversations + messages
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamptz not null default now()
);
create index if not exists conversations_user_idx
  on public.conversations (user_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);

-- ============================================================
-- Row Level Security: users touch ONLY their own rows.
-- Never trust client-supplied user_id; policies use auth.uid().
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_usage enable row level security;
alter table public.agent_memory enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- profiles: read own; insert own (trigger uses SECURITY DEFINER anyway);
-- update own EXCEPT role (role change blocked by policy + trigger guard).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own_no_role" on public.profiles;
create policy "profiles_update_own_no_role" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Guard: users can never escalate their own role via UPDATE.
drop trigger if exists profiles_no_role_escalation on public.profiles;
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.role is distinct from OLD.role then
    raise exception 'Role changes are not permitted.';
  end if;
  return NEW;
end;
$$;
create trigger profiles_no_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- user_usage: owner read/update only (rows created by signup trigger).
drop policy if exists "usage_select_own" on public.user_usage;
create policy "usage_select_own" on public.user_usage
  for select using (auth.uid() = user_id);

drop policy if exists "usage_update_own" on public.user_usage;
create policy "usage_update_own" on public.user_usage
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "usage_insert_own" on public.user_usage;
create policy "usage_insert_own" on public.user_usage
  for insert with check (auth.uid() = user_id);

-- agent_memory: full owner CRUD.
drop policy if exists "memory_owner_all" on public.agent_memory;
create policy "memory_owner_all" on public.agent_memory
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- conversations: full owner CRUD.
drop policy if exists "conversations_owner_all" on public.conversations;
create policy "conversations_owner_all" on public.conversations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: allowed only inside conversations owned by the caller.
drop policy if exists "messages_in_own_conversations" on public.messages;
create policy "messages_in_own_conversations" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- github_connections: one OAuth token per user, service-managed.
-- ------------------------------------------------------------
create table if not exists public.github_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  github_login text,
  access_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.github_connections enable row level security;
-- No client policies on purpose: tokens are written/read exclusively by the
-- server (service role / route handlers). Users can disconnect via DELETE
-- /api/github, which runs server-side with their session.

-- ============================================================
-- Signup trigger: create profile (role 'user') + usage row.
-- Idempotent: never overwrites an existing profile.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (NEW.id, NEW.email, 'user')
  on conflict (id) do nothing;

  insert into public.user_usage (user_id, requests_today, last_request_date)
  values (NEW.id, 0, (now() at time zone 'utc')::date)
  on conflict (user_id) do nothing;

  return NEW;
exception when others then
  -- Never block signup because of a profile/usage error.
  raise warning 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Vector recall RPC: cosine similarity, strictly caller-scoped.
-- The function runs as the caller (RLS applies); the explicit
-- user_id check guarantees no cross-user memory retrieval.
-- ============================================================
create or replace function public.match_memories(
  p_user_id uuid,
  p_embedding vector(1536),
  p_limit integer default 5
)
returns table (id uuid, content text, similarity float)
language sql
stable
set search_path = public
as $$
  select
    m.id,
    m.content,
    1 - (m.embedding <=> p_embedding) as similarity
  from public.agent_memory m
  where m.user_id = p_user_id
    and m.user_id = auth.uid()
    and m.embedding is not null
  order by m.embedding <=> p_embedding
  limit greatest(1, least(p_limit, 20));
$$;

-- ============================================================
-- projects: the workspace unit. Created here, imported from GitHub,
-- or continued. Each project owns files, environments and secrets.
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- URL-safe identifier: /projects/<slug>
  slug text not null,
  name text not null,
  description text not null default '',
  -- How the project entered ZeroKore.
  source text not null default 'created'
    check (source in ('created', 'github', 'imported')),
  github_repo text,
  github_branch text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
create index if not exists projects_user_idx
  on public.projects (user_id, updated_at desc);

-- ------------------------------------------------------------
-- project_files: the project's real file tree, edited in the code editor.
-- ------------------------------------------------------------
create table if not exists public.project_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  content text not null default '',
  language text not null default 'plaintext',
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);
create index if not exists project_files_project_idx
  on public.project_files (project_id, path);

-- ------------------------------------------------------------
-- project_environments: the named surfaces of a project (the old
-- "artifact" concept, project-scoped and split by kind).
-- 'preview'    — rendered html/svg output, shown in a sandboxed frame
-- 'terminal'   — command transcript (real output only, never simulated)
-- 'dev_server' — dev server binding/status for the project
-- 'secrets'    — key/value environment variables (values never leave the server)
-- ------------------------------------------------------------
create table if not exists public.project_environments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null
    check (kind in ('preview', 'terminal', 'dev_server', 'secrets')),
  label text not null default '',
  content text not null default '',
  language text not null default 'html',
  -- Server-owned state (status, port, last run). Never trusted from the client.
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind)
);
create index if not exists project_environments_project_idx
  on public.project_environments (project_id, kind);

-- ------------------------------------------------------------
-- project_secrets: environment variables for a project.
-- Server-only: encrypted at rest, and RLS has NO client policies, so a
-- browser session can never read a value back (same model as
-- github_connections). The UI sees key names only.
-- ------------------------------------------------------------
create table if not exists public.project_secrets (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null,
  -- AES-256-GCM ciphertext (iv:tag:data), written only by the server.
  value_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.project_environments enable row level security;
alter table public.project_secrets enable row level security;

-- projects: full owner CRUD.
drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all" on public.projects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- project_files: allowed only inside projects owned by the caller.
drop policy if exists "project_files_owner_all" on public.project_files;
create policy "project_files_owner_all" on public.project_files
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id and p.user_id = auth.uid()
    )
  );

-- project_environments: same ownership rule.
drop policy if exists "project_environments_owner_all"
  on public.project_environments;
create policy "project_environments_owner_all" on public.project_environments
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_environments.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_environments.project_id and p.user_id = auth.uid()
    )
  );

-- project_secrets: intentionally NO client policies (server-only access).

-- ------------------------------------------------------------
-- conversations can belong to a project. Nullable: a standalone chat
-- (the previous behaviour) stays valid and keeps working.
-- ------------------------------------------------------------
alter table public.conversations
  add column if not exists project_id uuid
  references public.projects (id) on delete set null;
create index if not exists conversations_project_idx
  on public.conversations (project_id, created_at desc);
