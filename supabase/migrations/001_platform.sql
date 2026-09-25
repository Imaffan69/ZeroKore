-- ============================================================
-- ZeroKore Platform migration (v2)
-- Plans, roles, credits, ledger, feedback, announcements,
-- file versions, MFA, sessions, login events, site flags,
-- admin audit, referrals, student verification, integrations.
-- Paste whole file into Supabase SQL editor. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- Roles: widen the hierarchy. Rank order (low→high):
--   user < viewer < support < moderator < admin < owner
-- Legacy 'admin' rows are preserved by the check below.
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in ('user','viewer','support','moderator','admin','owner')
);
-- 'admin' and 'owner' legacy/upgrade mapping handled by lib/rbac ranking,
-- so existing admin rows remain valid.

-- Plans & credits
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists credits_override integer;
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists mfa_enrolled boolean not null default false;
alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code) where referral_code is not null;

-- ------------------------------------------------------------
-- credits: current balance + daily reset per user
-- ------------------------------------------------------------
create table if not exists public.credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 30,
  last_reset_date date not null default (now() at time zone 'utc')::date,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- credit_ledger: every grant/spend/refund/bonus, append-only
-- ------------------------------------------------------------
create table if not exists public.credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in (
    'daily_reset','agent_run','refund','admin_grant','referral',
    'feedback_bonus','student_bonus','plan_grant','signup_bonus','adjustment'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- ------------------------------------------------------------
-- usage_runs: per-request token metering
-- ------------------------------------------------------------
create table if not exists public.usage_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid,
  project_id uuid,
  provider text,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  credits_charged integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_runs_user_idx
  on public.usage_runs (user_id, created_at desc);

-- ------------------------------------------------------------
-- feedback: site-wide "Need a hand?" submissions
-- ------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  status text not null default 'open' check (status in ('open','read','resolved')),
  page text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

-- ------------------------------------------------------------
-- announcements: admin-published banners/posts/changelog
-- ------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references auth.users (id) on delete set null,
  kind text not null default 'post' check (kind in ('banner','post','changelog','maintenance')),
  title text not null,
  body text not null,
  version text,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- site_flags: maintenance mode, shutdown, feature flags
-- ------------------------------------------------------------
create table if not exists public.site_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.site_flags (key, value) values
  ('maintenance', '{"enabled": false, "message": ""}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- file_versions: per-file history for the Changes tab
-- ------------------------------------------------------------
create table if not exists public.file_versions (
  id uuid primary key default uuid_generate_v4(),
  file_id uuid not null references public.project_files (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  content text,
  size integer,
  edited_by text not null default 'agent',
  created_at timestamptz not null default now()
);
create index if not exists file_versions_project_idx
  on public.file_versions (project_id, created_at desc);

-- ------------------------------------------------------------
-- mfa_factors: TOTP enrollment (secret encrypted app-side)
-- ------------------------------------------------------------
create table if not exists public.mfa_factors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  secret_encrypted text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists mfa_factors_user_idx on public.mfa_factors (user_id);

-- ------------------------------------------------------------
-- login_events: IP, geo, device per auth event
-- ------------------------------------------------------------
create table if not exists public.login_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in ('login','logout','signup','mfa_enroll','mfa_verify','password_change','session_revoke')),
  ip inet,
  country text,
  city text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists login_events_user_idx
  on public.login_events (user_id, created_at desc);

-- ------------------------------------------------------------
-- referrals / student_verifications / integrations / admin_audit
-- ------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  credits_granted integer not null default 25,
  created_at timestamptz not null default now()
);

create table if not exists public.student_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  domain text not null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '365 days')
);

create table if not exists public.integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('groq','deepseek','sambanova','gemini','openai','github')),
  encrypted_key text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.admin_audit (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

-- ------------------------------------------------------------
-- RLS: server-accessed by default; owner-scoped reads where the
-- UI needs them. admin_audit has NO client policies.
-- ------------------------------------------------------------
alter table public.credits enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.usage_runs enable row level security;
alter table public.feedback enable row level security;
alter table public.announcements enable row level security;
alter table public.site_flags enable row level security;
alter table public.file_versions enable row level security;
alter table public.mfa_factors enable row level security;
alter table public.login_events enable row level security;
alter table public.referrals enable row level security;
alter table public.student_verifications enable row level security;
alter table public.integrations enable row level security;
alter table public.admin_audit enable row level security;

drop policy if exists "credits_owner_read" on public.credits;
create policy "credits_owner_read" on public.credits
  for select using (auth.uid() = user_id);

drop policy if exists "ledger_owner_read" on public.credit_ledger;
create policy "ledger_owner_read" on public.credit_ledger
  for select using (auth.uid() = user_id);

drop policy if exists "usage_runs_owner_read" on public.usage_runs;
create policy "usage_runs_owner_read" on public.usage_runs
  for select using (auth.uid() = user_id);

-- feedback: users insert their own; no read (admin panel only).
drop policy if exists "feedback_owner_insert" on public.feedback;
create policy "feedback_owner_insert" on public.feedback
  for insert with check (auth.uid() = user_id);

-- announcements: public read of active rows.
drop policy if exists "announcements_public_read" on public.announcements;
create policy "announcements_public_read" on public.announcements
  for select using (active = true);

-- site_flags: public read (server gates maintenance).
drop policy if exists "site_flags_public_read" on public.site_flags;
create policy "site_flags_public_read" on public.site_flags
  for select using (true);

drop policy if exists "file_versions_owner_all" on public.file_versions;
create policy "file_versions_owner_all" on public.file_versions
  for all using (
    exists (select 1 from public.projects p where p.id = file_versions.project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.projects p where p.id = file_versions.project_id and p.user_id = auth.uid())
  );

drop policy if exists "mfa_owner_read" on public.mfa_factors;
create policy "mfa_owner_read" on public.mfa_factors for select using (auth.uid() = user_id);
drop policy if exists "login_events_owner_read" on public.login_events;
create policy "login_events_owner_read" on public.login_events for select using (auth.uid() = user_id);

drop policy if exists "student_verifications_owner_read" on public.student_verifications;
create policy "student_verifications_owner_read" on public.student_verifications
  for select using (auth.uid() = user_id);
drop policy if exists "integrations_owner_read" on public.integrations;
create policy "integrations_owner_read" on public.integrations
  for select using (auth.uid() = user_id);

drop policy if exists "referrals_party_read" on public.referrals;
create policy "referrals_party_read" on public.referrals
  for select using (auth.uid() in (referrer_id, referred_id));
