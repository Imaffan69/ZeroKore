-- ------------------------------------------------------------
-- 008_conversations_messages.sql
--
-- Chat history never persisted on a migrations-only database. `conversations`
-- and `messages` (and conversations.project_id) were defined solely in the
-- outdated `supabase/schema.sql`, so no migration ever created them.
--
-- The failure was silent rather than loud: lib/ai/agent.ts inserted the message
-- pair without checking the result, so a missing table produced a chat that
-- replied normally and then forgot everything.
--
-- Idempotent, and safe on a database that already has these from schema.sql.
-- ------------------------------------------------------------

create extension if not exists "pgcrypto";

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamptz not null default now()
);

-- Filed under its project so the project page can list its runs. Added by a
-- later edit in schema.sql and used by the agent, so it is required here too.
alter table public.conversations
  add column if not exists project_id uuid
  references public.projects (id) on delete cascade;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on public.conversations (user_id, created_at desc);
create index if not exists conversations_project_idx
  on public.conversations (project_id, created_at desc);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations: full owner CRUD. Policies key off auth.uid(), never a
-- client-supplied user_id.
drop policy if exists "conversations_owner_all" on public.conversations;
create policy "conversations_owner_all" on public.conversations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: reachable only through a conversation the caller owns. Without
-- this a user could read another user's chat by guessing a conversation id.
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
