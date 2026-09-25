# Changelog

Every shipped change, newest first. Each entry says what changed, why, and what
was actually verified. Deployment is via `git push origin main` → Vercel.

---

## 2026-09-25 — Desktop app, IP/location capture, owner fix

**Desktop (new, real)**
- Native Windows app under `desktop/`: `main.js` (Electron main), `preload.js`
  (isolated bridge), `make-icon.js` (icon generator). Not a mock.
- Hardened: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  Preload exposes only `version`, `platform`, `openExternal`, `openWorkspace`;
  `openExternal` accepts `http(s)` only. Off-origin navigation and popups are
  denied and handed to the system browser.
- Window state persists; single-instance lock; `zerokore://` deep links; native
  File/Edit/View/Go/Help menus.
- Icon generated from scratch (no image libraries available): hand-rolled polygon
  rasteriser + zlib PNG encoder → 1024×1024 mark.
- **Verified:** `npm run desktop` logged `[desktop] loaded
  https://zerokore.vercel.app/`; the packaged `release/win-unpacked/ZeroKore.exe`
  launched independently and loaded the site. Installer
  `release/ZeroKore-Desktop-1.0.0-x64.exe` (165.9 MB).
- Toolchain: no Rust on this machine, so Tauri was impossible — Electron chosen.
  npm 12 blocks install scripts, so the runtime binary was fetched manually via
  `node node_modules/electron/install.js`.

**Owner access (bug fix)**
- `admin_accounts` had a staff account with `is_owner: false` and **no owner row**,
  so "Site control" was owner-only and unreachable. Promoted the account to
  `role: owner, is_owner: true` (data fix, no SQL needed).

**IP + location capture (bug fix)**
- Root cause: email/password and username/password sign in authenticate directly
  against Supabase in the browser, so they never passed through
  `/auth/callback` — the only place logging existed. That is why the admin
  Security tab showed no IPs for most users.
- Added `POST /api/account/activity` plus a fire-and-forget `recordSignIn()` call
  on all three auth success paths, so **every** sign-in method is recorded.
- Real geolocation via ipgeolocation.io (`IP_LOCATION_API`): country, city,
  region, lat/long, timezone, ASN, network. Private IPs are never sent to a third
  party; results cached 60s per IP. Vercel geo headers remain the fallback.
- `logActivity` is fully fault-isolated and stores device/coordinates/network in
  `login_events.detail`.

**Admin errors (diagnosability)**
- `adminError` turned every unrecognised failure into an anonymous 500. It now
  logs server-side and returns the real message, mapping trigger/constraint
  rejections to 409 so they are visibly actionable.

---

## 2026-09-24 — Auth redirects, announcements, GitHub connect, UX

- **OAuth landing:** `/` forwards any `?code=`/`?error` to `/auth/callback`, so
  the code is never rendered on the landing page. Verified `307`.
- **404 fix:** `app/[username]/layout.tsx` gated *every* unmatched path through
  `requireSession`, so any unknown URL redirected to `/login` instead of the 404.
  The layout is now ungated; pages authorise themselves. Unknown usernames still
  404 identically to missing pages, so the namespace cannot be enumerated.
- **Announcements reach the public site:** blog and site banner read
  `announcements` with the session client, but the table has RLS with no public
  policy, so admin posts returned zero rows. Both now use the service client,
  filtered to `active = true` (drafts never leak).
- **GitHub connect:** OAuth `state` was a bare user id, so the return path was
  lost. It is now a signed envelope carrying `{userId, returnPath}`, validated on
  return; the import panel shows "Connected as …".
- **Settings no longer leaks admin info:** the System tab told every user that
  staff access was configured. Removed; the only entry point is `StaffRow`, which
  renders nothing unless `isStaff` is true.
- **Landing first-glance:** hero no longer `min-height: 100svh` (which pushed all
  content below the fold) — now `min(100svh, 860px)` with a four-tile proof row;
  the workspace mock now renders on mobile (was `hidden lg:block`).
- **Dashboard** no longer redirects away from its own content.
- **Redesigned 404** with real destination cards and a terminal readout.
- Added `.claude/skills/zerokore-design-system/SKILL.md`; `lib/ai/agent.ts`
  auto-injects it for UI-flavoured requests.
- Removed a UTF-8 BOM from `app/dashboard/page.tsx` (a typecheck hazard).

---

## 2026-09-24 — Admin auth unified

- The panel logged in with a username+password cookie, but every admin **API**
  required a Supabase Auth staff session — so every tab answered 401 and Site
  control was permanently owner-only.
- Added `admin_accounts` (migration 004) with scrypt hashing, roles and a
  single-owner trigger; the owner creates staff with their own username/password.
- Added `lib/admin-guard.ts` — one `requireStaff(min)` / `requireOwner()` used by
  every admin route, resolving the role from either credential.
- Sign-out fixed: clears the cookie (path widened to `/`) and ends the Supabase
  session (`scope: "global"`).

---

## 2026-09-23 — Platform features

Credits engine (30/100/350/600 + teams custom + student bonus, UTC reset,
token-metered, refunds, ledger), RBAC, MFA + login history endpoints, hidden
`/kore` → `/` dead end with the real panel at `/kore/admin`, file tools
(`list/read/write/edit/delete_file`), `@file` mentions, File Picker sub-agent,
`/skill` injection, transcript events, Changes tab with real diffs, savings
calculator, live user counter, pricing/earn/students/blog pages, account area,
privacy rewrite.
