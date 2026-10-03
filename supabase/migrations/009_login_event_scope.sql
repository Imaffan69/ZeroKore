-- ------------------------------------------------------------
-- 009 — login_events.event accepts every event the app records
--
-- `ActivityEvent` in lib/request-info.ts writes twelve kinds of event, but
-- migration 001 declared the column with a CHECK constraint listing only the
-- original seven auth events. Every `agent_run`, `file_edit`, `project_create`,
-- `github_sync` and `page_view` insert therefore failed with 23514 (check
-- violation), the insert's own retry without `detail` failed the same way, and
-- the error was swallowed by design — so those rows were never written at all.
--
-- That silently defeated part of the IP work: the browser-reported address is
-- cached in a cookie precisely so *server-recorded* activity carries the real
-- visitor address, but agent runs, file edits and GitHub syncs never reached the
-- table, so the admin Security tab could not show them.
--
-- Existing rows only ever held values from the old list, so re-adding the
-- constraint validates cleanly. Safe to re-run.
-- ------------------------------------------------------------
alter table public.login_events
  drop constraint if exists login_events_event_check;

alter table public.login_events
  add constraint login_events_event_check
  check (event in (
    'login',
    'logout',
    'signup',
    'mfa_enroll',
    'mfa_verify',
    'password_change',
    'session_revoke',
    'agent_run',
    'file_edit',
    'project_create',
    'github_sync',
    'page_view'
  ));
