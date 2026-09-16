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
   `conversations`, `messages`), RLS policies, the signup trigger
   (`handle_new_user`), and the `match_memories` vector-recall RPC.

3. **Environment** — copy and fill:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Purpose |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | for admin ops | Service-role key (server only) |
   | `GROQ_API_KEY` | at least one provider | Groq |
   | `DEEPSEEK_API_KEY` | at least one provider | DeepSeek |
   | `SAMBANOVA_API_KEY` | at least one provider | SambaNova |
   | `GEMINI_API_KEY` | at least one provider | Gemini |
   | `TAVILY_API_KEY` | no | Web search (agent continues without it) |

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

## Usage limits

15 AI requests/day for `user` role, unlimited for `admin`, enforced in
`lib/usage.ts` (counter resets when the stored UTC date is stale). The
sidebar shows `used / limit` with a gauge; admins see `Unlimited`. On 429 the
UI disables send, explains the reset, and preserves conversation + typed input.

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

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Every page returns `500 MIDDLEWARE_INVOCATION_FAILED` | Routing middleware runs on the CDN's Edge isolate and a failure there is **not containable**: it happens while the middleware module loads, before any `try/catch` runs, so *every* matched route 500s — including routes that do not exist. This project had no need for it: `/dashboard` and `/api/*` already gate themselves server-side. Do not re-add `middleware.ts` unless you can verify it on the host first. |
| Unsure which build is live | `curl -sS https://<domain>/robots.txt` — `robots.txt` is served straight from the CDN, so the `deploy-probe` line in it identifies the live build without involving any server code. |
| Login fails / auth broken after deploy | `NEXT_PUBLIC_SUPABASE_URL` must be a full `https://<ref>.supabase.co` URL (no trailing text) and the anon key must be set. These values are **inlined at build time**, so after changing them in the host's environment settings you must **redeploy** — a rebuild is required. |
| Landing shows but login fails | Check Supabase URL/anon key; confirm auth provider enabled |
| "No AI provider is configured" | Set at least one provider key and restart |
| Search says unavailable | Set `TAVILY_API_KEY` (optional) |
| Memory empty / no recall | Normal until the agent stores facts; check `agent_memory` rows |
| 429 on first request | Clock/date skew or stale row — check `user_usage` |
| Build errors about Supabase env | Build is static-safe; runtime throws clear errors when keys are missing |