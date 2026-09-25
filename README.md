# ZeroKore — Autonomous Intelligence Workspace

ZeroKore is a production-grade autonomous agentic AI platform with a premium
dark cyber-terminal interface. It combines:

- AI coding agent, research agent, and general assistant
- Tool execution (web search, memory, artifact generation)
- Provider cascade with automatic fallback
- Long-term user-scoped vector memory (pgvector)
- Conversations with history, titles, and deletion
- Artifact generation with safe previews (code / HTML / SVG / Markdown)
- Daily usage limits (15/day, unlimited for admins)
- Supabase Auth + Row Level Security on every user-owned table

## Technology

- Next.js 15 (App Router) · React 19 · TypeScript (strict)
- Tailwind CSS · Lucide React · Framer Motion
- Supabase: PostgreSQL · Auth · RLS · pgvector

AI cascade order: **Groq** (`openai/gpt-oss-120b`) → **DeepSeek**
(`deepseek-chat`) → **SambaNova** (`Meta-Llama-3.3-70B-Instruct`) → **Gemini**
(`gemini-3.6-flash`). Web search via **Tavily** when configured.

> Model IDs track what each provider actually serves (verified live). The
> original spec named retired IDs (`llama-3.3-70b-versatile`,
> `Meta-Llama-3.1-70B-Instruct`, `gemini-2.5-flash`); the cascade router uses
> the live equivalents above.

## Project structure

```text
zerokore/
├── app/
│   ├── (auth)/login, signup
│   ├── api/agent, health, conversations, usage, memory
│   ├── dashboard/
│   ├── globals.css, layout.tsx, page.tsx (landing)
├── components/agent/   (DualPanelCanvas, ExecutionTerminal, ArtifactViewer, ToolBar)
├── components/auth/    (AuthForm)
├── components/layout/  (Sidebar, Header)
├── lib/ai/             (cascade-router, tools, memory, agent)
├── lib/supabase/       (client, server)
├── lib/usage.ts, lib/utils.ts
├── supabase/schema.sql
├── types/index.ts
└── .env.example
```

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Supabase project** — create a project at https://supabase.com, then run
   `supabase/schema.sql` in the SQL editor. It creates extensions
   (`uuid-ossp`, `vector`), tables (`profiles`, `user_usage`, `agent_memory`,
   `conversations`, `messages`, `github_connections`, `projects`,
   `project_files`, `project_environments`, `project_secrets`), RLS policies,
   the signup trigger (`handle_new_user`), and the `match_memories` vector-recall
   RPC. The file is idempotent, so re-running it after an update applies only
   what is missing.

3. **Environment** — copy and fill:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Purpose |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | for GitHub + secrets | Service-role key (server only). Required to store GitHub OAuth tokens and read secret key names — both tables are RLS-locked with no client policies. |
   | `GROQ_API_KEY` | at least one provider | Groq |
   | `DEEPSEEK_API_KEY` | at least one provider | DeepSeek |
   | `SAMBANOVA_API_KEY` | at least one provider | SambaNova |
   | `GEMINI_API_KEY` | at least one provider | Gemini |
   | `TAVILY_API_KEY` | no | Web search (agent continues without it) |
   | `GITHUB_CLIENT_ID` | for GitHub import/push | OAuth app client id |
   | `GITHUB_CLIENT_SECRET` | for GitHub import/push | OAuth app client secret |
   | `ENCRYPTION_KEY` | for project secrets | 32-byte key (base64 or 64-char hex) |

   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` come from an OAuth app at
   https://github.com/settings/developers with the callback URL set to
   `https://<your-domain>/api/github/oauth`. Without them the import picker
   reports that GitHub is unconfigured instead of failing silently.

   `ENCRYPTION_KEY` encrypts project environment variables with AES-256-GCM
   before they are stored. Generate one with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Without it the Secrets environment stays read-only and says why — values are
   never written in plaintext. `/api/health` reports the live state of every
   server-side integration, so it is the fastest way to confirm a deployment is
   fully configured.

4. **Run**

   ```bash
   npm run dev      # development
   npm run lint     # lint
   npm run build    # production build
   npm start        # serve production build
   ```

## Authentication

Email/password via Supabase Auth. `/login` and `/signup` validate client-side
(email format, ≥8-char password, confirmation match) and surface duplicate
accounts, bad credentials, unverified accounts, and network errors. The signup
trigger creates a `profiles` row (role `user`) and a `user_usage` row
idempotently. Logout invalidates the session and redirects to login.

## Usage limits

Replaced by the credits economy (`lib/credits.ts` + `lib/plans.ts`): every
account gets a daily credit allowance that resets at 00:00 UTC — Free **30**,
Plus **100**, Pro **350**, Max **600**, Teams a per-workspace override, and a
verified student adds **+50**. One credit covers the base cost of a run, plus one
credit per 4k tokens of measured prompt + completion. Spend, refund and grant
events all land in `credit_ledger`. `admin`/`owner` accounts are exempt. While the
platform migration is pending, `/api/account/credits` reports `unenforced: true`
so the UI says the balance is informational rather than pretending to enforce it.

## Control panel (staff only)

The staff panel is deliberately unlisted:

| Path | Behaviour |
|---|---|
| `/kore` | Redirects to `/`. A dead end — nothing identifies it. |
| `/kore/admin` | The panel. Non-staff visitors get an ordinary **404**, identical to any missing page. |

Access is decided server-side on every request (`lib/rbac.ts`), never from client
state. There are two ways to become staff:

1. **Environment bootstrap** — `OWNER_EMAIL` (full authority) and
   `ADMIN_EMAILS` (comma-separated, `admin` rank). Emails are matched
   case-insensitively against the Supabase login address, so access works before
   any SQL has been applied. `/api/health` reports `staff` as a count so you can
   confirm it is picked up without publishing the addresses.
2. **Granted in the database** — `profiles.role`, one of
   `user < viewer < support < moderator < admin < owner`. Only the owner can
   change roles from the panel, and every change is written to `admin_audit`.

Tabs unlock by rank: **Overview** (viewer+) · **Feedback** (moderator+) ·
**Users**, **Security & IPs**, **Announcements**, **Site control** (admin+).
`Site control` holds the maintenance-mode switch and is owner-only. Staff also
see a small "Access level" row in **Settings → Account** linking to the panel;
ordinary accounts see nothing at all. `robots.txt` disallows `/kore`, and
`/kore/*` is served with `X-Robots-Tag: noindex, nofollow, noarchive`.

## Request logging & privacy

Signup and sign-in events record IP address, approximate location derived from
that IP, and device/browser from the user-agent (`login_events`, surfaced to
staff in **Security & IPs** and to the account owner in **Sign-in & security**).
This is disclosed in `/privacy`. Nothing here is used for advertising.

## Database & RLS

Every user-owned table has RLS; policies use `auth.uid()` only — the client
never supplies ownership. Users cannot change their own role (policy +
`prevent_role_escalation` trigger). Messages are reachable only through
conversations owned by the caller. `app/dashboard/layout.tsx` verifies the
session on the Node.js server and redirects to `/login` when there is none, and
every `/api/*` route re-authenticates server-side regardless (401). There is
deliberately **no `middleware.ts`**: routing middleware runs on the CDN's Edge
isolate, where it kept failing with `500 MIDDLEWARE_INVOCATION_FAILED` for every
matched route (even routes that do not exist), which took the whole site down.
A gate in a server layout cannot do that — an error there is contained to
`/dashboard`, which is why public pages keep rendering when Supabase is missing,
malformed, or unreachable.

## Agent pipeline

```text
Prompt → auth → validate → rate limit → load conversation → recall memory →
mode context → cascade chat → tools (≤8) → artifact → persist → respond
```

Safe terminal events only (`[Agent Started]`, `[Memory Retrieved]`,
`[Tool Call]`, `[Tool Completed]`, `[Provider Fallback]`,
`[Generating Artifact]`, `[Completed]`). No chain-of-thought is exposed.
Stop cancels the frontend request; the backend always caps iterations.

## Security notes

- Provider keys + service-role key: server only, never in the bundle.
- Generated HTML/SVG render only in a `sandbox=""` iframe; Markdown/code is
  escaped before rendering.
- Request size limits, tool-iteration cap, secret-refusal in `store_memory`.
- Structured server logs contain events only — no keys, tokens, or passwords.
- Response headers from `next.config.ts`: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options:
  SAMEORIGIN`, and a `Permissions-Policy` that denies camera, microphone,
  geolocation, and payment. HSTS is set by the platform.
- Project environment variables are encrypted with AES-256-GCM before insert;
  `project_secrets` has RLS with no client policy, so values are never readable
  from the browser.
- GitHub tokens live in `github_connections` (no client policies) and are read
  only inside route handlers after ownership checks.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Every page returns `500 MIDDLEWARE_INVOCATION_FAILED` | Routing middleware runs on the CDN's Edge isolate and a failure there is **not containable**: it happens while the middleware module loads, before any `try/catch` runs, so *every* matched route 500s — including routes that do not exist. This project had no need for it: `/dashboard` and `/api/*` already gate themselves server-side. Do not re-add `middleware.ts` unless you can verify it on the host first. |
| Unsure which build is live | `curl -sS https://<domain>/robots.txt` — `robots.txt` is served straight from the CDN, so the `deploy-probe` line in it identifies the live build without involving any server code. |
| Every route 404s with a plain-text Vercel `NOT_FOUND`, but `/robots.txt` still works | The deployment is being published as a **static site** instead of a Next.js app, so only `public/` is served and none of the app code runs. That is a host project setting, not a code problem: Settings → Build & Development Settings needs Framework Preset **Next.js** and an **empty** Output Directory. `vercel.json` pins the preset from the repo so the dashboard cannot override it. |
| Login fails / auth broken after deploy | `NEXT_PUBLIC_SUPABASE_URL` must be a full `https://<ref>.supabase.co` URL (no trailing text) and the anon key must be set. These values are **inlined at build time**, so after changing them in the host's environment settings you must **redeploy** — a rebuild is required. |
| Landing shows but login fails | Check Supabase URL/anon key; confirm auth provider enabled |
| "No AI provider is configured" | Set at least one provider key and restart |
| Search says unavailable | Set `TAVILY_API_KEY` (optional) |
| Memory empty / no recall | Normal until the agent stores facts; check `agent_memory` rows |
| 429 on first request | Clock/date skew or stale row — check `user_usage` |
| Import says "GitHub is not configured on the server" | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are unset. Create the OAuth app, set the callback URL to `https://<domain>/api/github/oauth`, add both variables, then redeploy. `/api/health` should report `github: configured`. |
| Secrets environment says "Set ENCRYPTION_KEY" | Generate a 32-byte key (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), add it as `ENCRYPTION_KEY`, redeploy. `/api/health` should report `encryption: configured`. |
| Live config unknown | `curl -sS https://<domain>/api/health` — reports models, database, auth, search, GitHub, and encryption state without exposing any value. |
| Build errors about Supabase env | Build is static-safe; runtime throws clear errors when keys are missing |