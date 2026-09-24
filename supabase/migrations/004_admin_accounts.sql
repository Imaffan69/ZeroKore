-- 004 — Admin accounts (owner + staff) for the hidden /kore/admin panel.
--
-- These accounts are SEPARATE from public Supabase Auth accounts: staff sign
-- in with a username + password only. The first (owner) account is the one the
-- site owner signs in with; from inside the panel the owner can create further
-- staff accounts, each with their own username, password and role.
--
-- Run after 001_platform.sql and 003_admin_credentials.sql.

create table if not exists admin_accounts (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  role          text not null default 'viewer'
                check (role in ('viewer','support','moderator','admin','owner')),
  is_owner      boolean not null default false,
  disabled      boolean not null default false,
  created_by    text,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists admin_accounts_role_idx on admin_accounts (role);

alter table admin_accounts enable row level security;

grant select, insert, update, delete on table admin_accounts to service_role;

-- Staff who sign in with a username + password have no profile row, so the
-- audit trail and announcements record a label instead of a profile id.
alter table admin_audit add column if not exists actor_label text;
alter table announcements add column if not exists author_label text;

-- Only the service role (server-side) reads/writes this table. There are no
-- policies on purpose: direct PostgREST access from the anon/authenticated keys
-- is denied, so staff accounts can only be used through the server routes.

-- Exactly one owner may exist at a time.
create or replace function admin_accounts_single_owner() returns trigger
language plpgsql as $$
begin
  if new.is_owner and exists (
    select 1 from admin_accounts where is_owner and id <> new.id
  ) then
    raise exception 'An owner account already exists.';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_accounts_single_owner_trg on admin_accounts;
create trigger admin_accounts_single_owner_trg
  before insert or update on admin_accounts
  for each row execute function admin_accounts_single_owner();

-- Promote the existing bootstrap credential (set through
-- POST /api/kore/admin/setup, which writes admin_credentials) to the owner
-- account. Runs only while no account exists yet.
do $$
declare
  v_user text;
  v_hash text;
begin
  if not exists (select 1 from admin_accounts) then
    select username, password_hash into v_user, v_hash
      from admin_credentials
      order by updated_at desc
      limit 1;

    if v_user is not null and v_hash is not null then
      insert into admin_accounts (username, password_hash, role, is_owner, created_by)
      values (v_user, v_hash, 'owner', true, 'bootstrap')
      on conflict (username) do nothing;
    end if;
  end if;
end $$;
