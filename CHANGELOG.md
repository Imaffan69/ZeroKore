# Changelog

Every shipped change, newest first. Each entry says what changed, why, and what
was actually verified. Deployment is via `git push origin main` → Vercel.

---

## 2026-10-03 (b) — The address the network hides: reported-IP fallback and diagnostics

**Header fixes alone could not help** — reported after the previous entry as
"IP is still the same all over". Correct, and the reason is structural: when the
app sits behind a proxy, tunnel or hosting layer that does **not forward** the
visitor's address, every request arrives carrying the same infrastructure IP.
No header parsing can recover what the network never sent, so the previous
change could only fix mis-ordered headers, not a missing address.
- `resolveIp()` now returns the address **and where it came from**
  (`detail.ipSource`: `header:<name>`, `client-reported`, `header-fallback`,
  `legacy`) plus the exact chain it saw. `extractIp()` delegates to it.
- When headers yield nothing routable, the browser reports its own address
  (`lib/client-ip.ts` → `api.ipify.org`, keyless, CORS `*`, one request per
  session, cached in `sessionStorage`). `POST /api/account/activity` answers with
  `needsHint`, and the follow-up call **amends the row it already wrote** rather
  than inserting a second sign-in event. Private/spoofed hints are rejected.
- The value is also cached in a 12-hour `zk_client_ip` cookie, so server-recorded
  events — agent runs, file edits, GitHub syncs — carry the same real address
  instead of the shared one. A healthy deployment makes **zero** third-party calls.
- OAuth sign-ins are covered too. They leave the browser entirely (Supabase →
  `/auth/callback`), so the sign-in form's request never runs. `/auth/callback`
  now sets a `zk_needs_ip` flag when it could not see a routable address, and
  `ClientIpBootstrap` (mounted in the authenticated dashboard layout) answers it
  once the browser is back, writing the same cookie. Without this, Google/GitHub
  users kept the shared address while email users were fixed.
- The panel names the cause: when one address covers ≥80% of events a banner
  explains that the deployment is not forwarding client IPs, and every address
  row shows its source. Reported addresses are labelled `reported by browser` and
  never passed off as server-observed.
- Google Maps removed from the map widget (see previous entry): OpenStreetMap
  only, plus copy-coordinates and an OpenStreetMap deep link.

**Verification**
- `bun scripts/check-request-info.ts` — now 25 assertions: header precedence,
  header-over-hint precedence, hint used when the proxy hides the address, the
  cookie path, private/junk hints rejected, `extractIp` parity, normalisation,
  reserved ranges, and a live `8.8.8.8` lookup → `37.3393939, -121.8949553`.
  **exit 0.**
- `api.ipify.org` and `api64.ipify.org` checked with an `Origin` header: **200**
  with `access-control-allow-origin: *`, so the browser call works.
- `tsc --noEmit` exit 0 · `next lint` (whole `app`, `components`, `lib`) exit 0 ·
  `next build --experimental-build-mode compile` exit 0.

---

## 2026-10-03 — Admin IPs are per device, and every user gets their own map

**Every device of every user showed the same IP**
- `extractIp()` consulted `x-real-ip` **first**. Behind a CDN, the Vercel firewall
  or any hosting proxy that header is usually the *proxy's* address, not the
  visitor's — so every sign-in in the admin panel collapsed onto one shared IP,
  which is exactly the "same user, different devices, same IP" report.
- Fix: the proxy chain is walked in authority order (`cf-connecting-ip`,
  `true-client-ip`, `x-client-ip`, `fly-client-ip`, `fastly-client-ip`,
  `x-vercel-forwarded-for`, `x-forwarded-for`, `x-forwarded`, `x-real-ip` last)
  and the **first public hop** wins, so an internal load balancer is skipped
  rather than reported as the visitor. Header values are normalised (bracketed
  IPv6, `host:port`, quoted strings, `::ffff:` mapped IPv4), and `isPublicIp`
  now also rejects CGNAT, link-local, multicast, reserved and documentation
  ranges.

**The map was empty because one provider with one key was the only path**
- A missing/unconfigured `IP_LOCATION_API` meant `lookupGeo` returned `null`:
  no latitude, no longitude, nothing to plot. There was no fallback and no way
  to see why.
- Fix: a provider chain — ipgeolocation.io when `IP_LOCATION_API` (or an alias)
  is configured, then keyless `ipwho.is`, then keyless `ip-api.com`. Whichever
  answers supplies country, region, city, **latitude/longitude**, timezone, ASN
  and network; the provider is recorded so the panel can show its source.
  `0,0` is rejected as "unplaced" rather than drawn in the Gulf of Guinea, and
  results are cached for 6h (5 min on failure). `geolocateIp()` is exported so
  the panel can fill in coordinates for rows that predate the enrichment.

**Security & IPs is now per user, per device, per map**
- `GET /api/admin/security` returns a `users[]` breakdown: each account with its
  devices (IP, hit count, last seen, device string, city/region/country,
  latitude/longitude, timezone, ASN, network). Addresses with no stored
  coordinates are resolved live, capped at 40 per refresh, so historical rows
  appear on the map too. Every event row now carries top-level coordinates
  instead of a jsonb blob the client had to dig through.
- `AdminSecurity` gained a per-user section: open a user to see every device,
  the full IP details, and **that user's own map**. Picking a device re-centres
  the map on that address.
- `components/admin/UserMap.tsx` is the widget: a **keyless OpenStreetMap** embed.
  No API key, no account, no signup, so the panel cannot end up with a dead map
  because a key was never added; no commercial map provider is involved at all.
  It adds copy-coordinates and a deep link to OpenStreetMap. No mapping SDK is
  bundled, tiles are filtered to the panel's monochrome, and the iframe only
  mounts when a card is opened.
- The world overview now plots **one pin per user+address** instead of stacking
  every event, and its markers are monochrome to match the design system.

**Verification**
- `bun scripts/check-request-info.ts` — new, 18 assertions: header precedence,
  chain parsing, normalisation of bracketed/port/quoted/mapped-IPv4 values,
  reserved-range rejection, and two devices behind one proxy resolving to two
  different addresses. Live lookup of `8.8.8.8` returned
  `37.3393939, -121.8949553` via ipwho.is. **All checks passed.**
- `bunx tsc --noEmit` clean · `next lint` clean · `next build
  --experimental-build-mode compile` clean.
- Map endpoints checked over the network: OpenStreetMap embed **200**, OpenStreetMap
  deep link **200**.

---

## 2026-09-25 — Sign-in 500 and suspended-account UX

**The 500 affecting every signed-in user**
- `logActivity()` inserted a `detail` (jsonb) column into `login_events` that was
  never added to the database — the code shipped ahead of its migration. Every
  insert failed on an unknown column, so `POST /api/account/activity` returned
  **500** on every sign-in and the admin Security tab had **no IP addresses at
  all** (the table was empty).
- Fix: `supabase/migrations/005_login_event_detail.sql` adds the column, and
  `logActivity` now **retries without `detail`** when the insert is rejected, so
  the audit row is recorded even on a database without the migration. The failure
  is logged server-side instead of vanishing. `logAuthEvent` hardened identically.
- Run `005_login_event_detail.sql` in Supabase to restore the device/coordinate
  enrichment. Sign-in recording works without it.

**Suspended accounts are now told directly, on the login page**
- Supabase Auth does not know about `profiles.suspended`, so it created a session
  for a banned account and every later request failed 403 — the user saw a generic
  error and never learned why.
- `GET /api/account/identity` now uses `getSession()` instead of `requireUser()`
  and reports `suspended`, so the question can be asked without being blocked by it.
- The login form checks it after every successful sign-in (email, username, OAuth),
  **signs the session back out**, and shows *"This account has been suspended.
  Contact support if you believe this is a mistake."* — they never reach another page.
- Enforcement is unchanged: `requireUser()` remains the authority, so an unsuspended
  user is never blocked by a failed check.

**Verification**
- Live database checked directly: `profiles.suspended` exists, **no account is
  currently suspended**, `credits` and `site_flags` healthy, `login_events` empty
  (confirming the logging gap).
- Added `scripts/diag-login.js`: a reproducible diagnostic that signs in as a real
  account and calls every protected route, so future "it's throwing 500" reports are
  measured rather than guessed. Its first run exposed that the Supabase token
  endpoint is POST-only (a GET returns 405).
- `tsc --noEmit` clean, `next build` 46/46 pages.


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
