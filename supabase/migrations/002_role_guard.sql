-- ============================================================================
-- ZeroKore migration 002 — role guard fix (run after 001_platform.sql)
-- ============================================================================
-- Why this exists
-- ---------------
-- schema.sql installs `prevent_role_escalation`, which raises on ANY change to
-- `profiles.role`. That was written when the only two roles were 'user' and
-- 'admin', and it makes the staff role hierarchy unusable: an admin panel grant
-- from the service role hits the same exception and the update is rejected.
--
-- The guard's real job is stopping a signed-in user from promoting *themselves*.
-- Row-level security already prevents a session from touching another user's
-- row (`auth.uid() = id` is the only policy), so narrowing the trigger to
-- self-changes keeps the protection and unblocks legitimate staff management.
--
-- Effect after running:
--   * a user's own session still cannot change its role  → still blocked
--   * service-role / dashboard updates (auth.uid() is null) → allowed
-- ============================================================================

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  -- Only a signed-in user acting on their own row is a privilege escalation.
  -- With no JWT (service role, migrations, dashboard) the change is trusted.
  if NEW.role is distinct from OLD.role then
    if actor is not null and actor = OLD.id then
      raise exception 'Role changes are not permitted.';
    end if;
    NEW.role_changed_at := now();
  end if;
  return NEW;
end;
$$;

-- Timestamp of the last staff change, so the panel can show role history
-- without reading the full audit table.
alter table public.profiles
  add column if not exists role_changed_at timestamptz;

-- Suspension follows the same rule as roles: self-service is never allowed.
-- (RLS already blocks cross-account writes from a session; this documents the
-- intent and prevents a user from un-suspending themselves if a policy is ever
-- relaxed.)
create or replace function public.prevent_self_unsuspend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if OLD.suspended = true and NEW.suspended = false then
    if actor is not null and actor = OLD.id then
      raise exception 'Suspension can only be lifted by staff.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_no_self_unsuspend on public.profiles;
create trigger profiles_no_self_unsuspend
  before update on public.profiles
  for each row execute function public.prevent_self_unsuspend();

notify pgrst, 'reload schema';
