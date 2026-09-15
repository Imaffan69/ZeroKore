# ZeroKore — Full Comprehensive Development Plan

## 1. Mission

Build **ZeroKore**, a production-grade autonomous agentic AI platform with a premium dark cyber-terminal interface.

ZeroKore combines:
- AI coding agent
- Research agent
- General assistant
- Tool execution
- Web search
- Long-term vector memory
- Conversations
- Artifact generation
- Code/HTML/SVG/Markdown preview
- Provider fallback
- Usage limits
- Secure authentication

The final application must be functional, responsive, secure, modular, polished, and production-ready. Do not create fake buttons or simulated backend functionality.

---

# 2. Technology

Use:

- Next.js 15 App Router
- React 19
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- Lucide React
- Framer Motion
- Supabase PostgreSQL
- Supabase Auth
- Supabase RLS
- Supabase pgvector

AI provider order:

1. Groq — `llama-3.3-70b-versatile`
2. DeepSeek — `deepseek-chat`
3. SambaNova — `Meta-Llama-3.1-70B-Instruct`
4. Gemini — `gemini-2.5-flash`

Search:
- Tavily when configured.

Never expose provider API keys to the browser.

---

# 3. Visual Identity

Default theme: dark.

Colors:

- Background: `#090d16`
- Panels: `#111827`
- Accent: `#10b981`
- Primary text: `#e2e8f0`
- Muted text: `#94a3b8`

Design language:

- futuristic
- cyber-terminal
- professional
- minimal
- technical
- premium

Use subtle borders, glow, gradients, status indicators, and motion. Avoid excessive animation.

Animations should communicate state rather than decorate everything.

---

# 4. Responsive Design

ZeroKore must work correctly on mobile, tablet, laptop, desktop, and large monitors.

## Desktop

Use a persistent sidebar and a dual-panel workspace.

```text
Sidebar | Execution | Artifact
```

## Tablet

Sidebar becomes collapsible.

Dual panels remain available when space allows. Otherwise stack them.

## Mobile

Use a single-panel interface with:

```text
[Execution] [Artifact]
```

Sidebar becomes a drawer.

Rules:

- hamburger opens sidebar
- outside click closes sidebar
- Escape closes sidebar
- no horizontal overflow
- touch targets must be comfortable
- input must remain accessible above mobile keyboard
- artifact viewer must fit screen width
- long code must horizontally scroll inside its own container
- panels must never break the page layout

When resizing the browser, components must adapt without requiring reload.

---

# 5. Application Structure

```text
zerokore/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── agent/route.ts
│   │   └── health/route.ts
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── agent/
│   │   ├── DualPanelCanvas.tsx
│   │   ├── ExecutionTerminal.tsx
│   │   ├── ArtifactViewer.tsx
│   │   └── ToolBar.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   └── ui/
├── lib/
│   ├── ai/
│   │   ├── cascade-router.ts
│   │   ├── tools.ts
│   │   ├── memory.ts
│   │   └── agent.ts
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── middleware.ts
├── supabase/
│   └── schema.sql
├── types/
│   └── index.ts
├── middleware.ts
├── .env.example
├── package.json
└── README.md
```

Keep components modular. Do not create one enormous component.

---

# 6. Landing Page

Create a polished landing page at `/`.

Include:

- ZeroKore logo/name
- short product description
- animated background
- feature highlights
- AI provider information
- security statement
- CTA buttons
- Login
- Sign Up

CTA behavior:

- Login → `/login`
- Sign Up → `/signup`
- authenticated users can be redirected to `/dashboard`

The landing page must be responsive.

On mobile, simplify decorative animations while keeping the interface attractive.

---

# 7. Authentication

Use Supabase email/password authentication.

Pages:

- `/login`
- `/signup`

## Signup

Fields:

- email
- password
- confirm password

Validate client and server side.

Display:

- invalid email
- weak password
- password mismatch
- duplicate account
- network errors

After successful signup, show appropriate verification state if email confirmation is enabled.

Never expose database credentials.

## Login

Handle:

- incorrect credentials
- unverified account
- network error
- rate-limit/auth errors

Successful login → dashboard.

## Logout

Logout must invalidate the session and redirect to login/home.

---

# 8. Middleware

Protect:

```text
/dashboard/*
/api/agent
```

Unauthenticated dashboard requests redirect to authentication.

Unauthenticated `/api/agent` requests return:

```text
401 Unauthorized
```

Never rely only on frontend route protection.

---

# 9. Database

Enable:

```sql
uuid-ossp
vector
```

Tables:

## profiles

```text
id UUID PRIMARY KEY REFERENCES auth.users
email
role
created_at
```

Roles:

```text
user
admin
```

Default role must be `user`.

## user_usage

```text
user_id
requests_today
last_request_date
```

## agent_memory

```text
id
user_id
content
embedding vector(1536)
created_at
```

## conversations

```text
id
user_id
title
created_at
```

## messages

```text
id
conversation_id
role
content
tool_calls JSONB
created_at
```

---

# 10. Row Level Security

Enable RLS on every user-owned table.

Users can only:

- read their own records
- insert their own records
- update their own records
- delete their own records

Never trust a client-supplied `user_id`.

Always obtain the authenticated user from Supabase server-side.

Users must never be able to change their own role.

Only trusted server-side administration can create/change admin privileges.

Never expose the Supabase service-role key to the client.

---

# 11. Signup Database Trigger

After a successful Supabase user signup:

1. Create profile.
2. Set role to `user`.
3. Create usage row.
4. Do not overwrite an existing profile unexpectedly.
5. Handle trigger errors safely.

---

# 12. Usage Limits

Normal users:

**15 AI requests per day.**

Admins:

**Unlimited.**

Enforcement must happen server-side.

Algorithm:

1. Authenticate user.
2. Read usage row.
3. If stored date is older than today, reset counter.
4. Check role.
5. If normal user has reached 15, return HTTP `429`.
6. Otherwise increment usage.
7. Continue request.

Frontend should display:

```text
12 / 15 requests today
```

with a visual usage gauge.

Admin:

```text
Unlimited
```

When limit is reached:

- disable/limit send action
- show clear explanation
- preserve existing conversation
- do not lose typed input

---

# 13. Dashboard

Dashboard is the primary ZeroKore workspace.

Layout:

```text
┌───────────────┬──────────────────────────────────┐
│               │ Header                           │
│   Sidebar     ├────────────────┬─────────────────┤
│               │ Execution      │ Artifact        │
│               │ Terminal       │ Viewer          │
│               ├────────────────┴─────────────────┤
│               │ Tool Bar / Input                 │
└───────────────┴──────────────────────────────────┘
```

---

# 14. Sidebar

Display:

- ZeroKore branding
- current AI provider
- provider status
- database status
- authentication status
- usage gauge
- agent mode buttons
- New Task
- Conversations
- Memory
- Settings
- Logout

## Sidebar reactions

Hover:
- subtle highlight

Click:
- active state

Mobile:
- drawer animation

Provider status:

```text
● GROQ
● DEEPSEEK
● SAMBANOVA
● GEMINI
```

Do not claim a provider is online unless the backend has actually verified it.

---

# 15. Header

Show:

- current conversation/task
- selected agent mode
- connection/status indicator
- mobile menu button
- optional account control

Header remains usable while scrolling.

On mobile, compress secondary information.

---

# 16. Agent Modes

Provide three modes:

### Coding Agent

Optimized for:

- programming
- debugging
- architecture
- code generation
- code explanation
- artifact generation

### Research Agent

Optimized for:

- research
- web search
- comparison
- fact gathering
- source-based answers

### General Assistant

Optimized for:

- normal questions
- writing
- explanations
- planning
- everyday assistance

The selected mode must be included in the server-side agent context.

---

# 17. Agent Pipeline

Core pipeline:

```text
User Prompt
    ↓
Authenticate
    ↓
Validate Input
    ↓
Rate Limit
    ↓
Load Conversation
    ↓
Retrieve Relevant Memory
    ↓
Select Agent Mode
    ↓
AI Provider
    ↓
Optional Tool Call
    ↓
Tool Result
    ↓
AI Continues
    ↓
Final Response
    ↓
Optional Artifact
    ↓
Save Message
    ↓
Return/Stream Result
```

Maximum:

**8 tool iterations per request.**

Never allow infinite agent loops.

---

# 18. AI Cascade Router

Implement a reusable provider abstraction.

Every provider should expose a consistent interface.

Try providers in order:

```text
Groq
↓
DeepSeek
↓
SambaNova
↓
Gemini
```

Fallback on:

- HTTP 429
- HTTP 500–599
- timeout
- temporary network error
- temporary provider failure

Do not fallback for every possible application bug. Validation and malformed internal requests should fail normally.

When fallback happens, emit a safe event:

```text
[Provider Fallback]
```

Do not expose:

- API keys
- internal request headers
- secrets
- raw stack traces

If all providers fail, return a clean error.

---

# 19. AI Provider Status

The UI should indicate:

```text
Provider: Groq
```

If fallback occurs:

```text
Groq unavailable → DeepSeek
```

Keep the message short.

Do not expose sensitive provider diagnostics.

The backend should log detailed diagnostics securely where appropriate.

---

# 20. Execution Terminal

The execution terminal is the main interaction area.

Display:

- user messages
- AI responses
- tool activity
- safe agent events
- provider fallback
- artifact generation

Example event sequence:

```text
[Agent Started]
[Memory Retrieved]
[Tool Call]
[Tool Completed]
[Provider Fallback]
[Generating Artifact]
[Completed]
```

Never expose hidden chain-of-thought.

Only show safe operational events.

---

# 21. Chat Behavior

User sends message.

Immediately:

1. disable duplicate sending
2. show loading state
3. append user message
4. show agent activity
5. process backend request
6. stream if practical
7. render final response
8. re-enable input

If request fails:

- show readable error
- preserve user message
- preserve typed unsent content when possible
- allow retry

Do not reload the entire page.

---

# 22. Input Toolbar

Include:

- multiline text input
- Send
- Stop
- New Task
- Agent mode selector

Keyboard behavior:

- Enter → send
- Shift+Enter → newline

Do not send empty messages.

Trim unnecessary whitespace.

Limit request size server-side.

On mobile, controls should remain reachable above the keyboard.

---

# 23. Stop Generation

Provide a Stop button while an agent request is running.

Stopping should:

- cancel/abort frontend request where possible
- stop UI loading state
- prevent further rendering from the cancelled request
- keep already received content
- return input controls to normal

The backend must also enforce iteration limits so cancellation cannot create runaway processing.

---

# 24. Conversations

Users can create multiple conversations.

Sidebar should show recent conversations.

Each conversation belongs to one user.

Features:

- new conversation
- open conversation
- rename conversation if implemented
- delete conversation
- preserve message history

When a conversation is opened:

- load messages
- restore title
- restore relevant UI state
- do not expose another user's messages

---

# 25. Automatic Conversation Titles

After the first meaningful message, generate a short title.

Example:

```text
Build React Dashboard
```

Avoid huge titles.

If title generation fails, use a safe fallback such as:

```text
New Conversation
```

---

# 26. Artifact System

ZeroKore must support generated artifacts.

Supported types:

- code
- HTML
- SVG
- Markdown

Normalize artifact data:

```text
type
title
content
language
```

Example:

```json
{
  "type": "code",
  "title": "app.tsx",
  "content": "...",
  "language": "typescript"
}
```

---

# 27. Artifact Viewer

Tabs:

```text
Preview
Code
Markdown
```

Show:

- artifact title
- language/type
- copy button
- preview
- code viewer

## Code

Use syntax highlighting if practical.

Provide copy button.

Show copied state:

```text
Copied ✓
```

Automatically return to normal after a short period.

## HTML

Render inside a sandboxed iframe.

Never inject arbitrary generated HTML directly into the main application DOM.

Do not execute generated JavaScript in the main application context.

## SVG

Render safely.

## Markdown

Render formatted Markdown with safe sanitization.

---

# 28. Artifact Panel Reactions

When no artifact exists:

```text
No artifact generated yet.
```

When artifact appears:

- panel animates in subtly
- switch to artifact tab when appropriate
- preserve execution history

When artifact changes:

- update viewer without full page reload

When copy succeeds:

- button changes state
- show visual confirmation

When artifact is invalid:

- show safe error
- retain raw content where possible

---

# 29. Web Search Tool

Implement:

```text
web_search
```

Use Tavily when configured.

Return structured data:

```text
title
url
snippet
```

If Tavily is unavailable:

- do not fake search results
- tell the agent search is unavailable
- allow the agent to continue if it can answer without search

Do not expose API keys.

Research responses should clearly distinguish sourced information from model-generated reasoning.

---

# 30. Memory System

ZeroKore has long-term user-scoped memory.

Functions:

```text
store_memory
search_memory
delete_memory
```

Use pgvector.

Memory search:

- generate/query embeddings
- cosine similarity using pgvector
- restrict search to authenticated user

Never allow cross-user memory retrieval.

---

# 31. Memory Failure Behavior

Memory is helpful but must not become a single point of failure.

If memory search fails:

- log safely
- continue without memory

If memory storage fails:

- do not crash the entire conversation

The user should still receive the AI response.

---

# 32. Automatic Memory

The agent may identify useful long-term information.

Do not blindly save every message.

Prefer durable information such as:

- user preferences
- recurring project context
- useful project decisions

Do not store secrets or sensitive information unnecessarily.

Memory should be user-specific.

---

# 33. Settings

Provide a settings area for safe user preferences.

Potential settings:

- theme
- agent mode
- interface density
- animation preference
- memory preference

Respect reduced-motion accessibility preferences.

Never place API secrets in frontend settings.

---

# 34. Health API

Create:

```text
GET /api/health
```

Return safe application status.

Potential information:

```text
application: healthy
database: connected
authentication: configured
providers: available/configured
```

Never expose:

- API keys
- service-role credentials
- stack traces
- secret environment values

---

# 35. Error Handling

Every major layer must have controlled errors.

Categories:

### Authentication error

Show:

```text
Authentication required.
```

### Rate limit

HTTP:

```text
429
```

Show:

```text
Daily AI request limit reached.
```

### Provider failure

Try next provider.

### All providers failed

Show:

```text
ZeroKore could not reach an AI provider. Please try again later.
```

### Database failure

Show a friendly message without exposing SQL details.

### Tool failure

Allow agent to continue where safe.

### Invalid request

Return:

```text
400
```

with a safe validation message.

---

# 36. Loading States

Never leave blank screens.

Use:

- skeletons
- spinners
- animated terminal indicators
- disabled controls

Examples:

```text
Connecting...
Loading conversation...
Searching...
Generating...
```

Animations should be subtle.

---

# 37. Empty States

Create useful empty states.

Dashboard with no conversation:

```text
Ready when you are.
Start a task with ZeroKore.
```

No conversations:

```text
No conversations yet.
```

No memory:

```text
No saved memory yet.
```

No artifact:

```text
No artifact generated.
```

---

# 38. Accessibility

Implement:

- semantic HTML
- keyboard navigation
- visible focus states
- sufficient contrast
- accessible buttons
- labels for inputs
- ARIA where necessary
- Escape handling for drawers/modals
- reduced motion support

Do not rely solely on color to communicate state.

---

# 39. Performance

Optimize:

- bundle size
- client components
- unnecessary re-renders
- animations
- large conversation rendering
- code viewers
- database queries

Prefer server components where possible.

Only use `"use client"` where interactivity requires it.

Lazy-load heavy artifact/code viewer components when beneficial.

---

# 40. Security

Mandatory rules:

- API keys server-side only
- service-role key server-side only
- validate all inputs
- enforce ownership server-side
- enforce rate limits server-side
- limit request sizes
- limit tool iterations
- sanitize rendered content
- sandbox HTML
- never execute generated JS in the main page
- never expose stack traces
- never expose system prompts
- never expose hidden chain-of-thought
- never trust client roles
- never trust client user IDs

Use secure cookies/session handling through Supabase.

---

# 41. Environment Variables

Create `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=
DEEPSEEK_API_KEY=
SAMBANOVA_API_KEY=
GEMINI_API_KEY=

TAVILY_API_KEY=
```

Application must work gracefully when optional providers/tools are not configured.

Never commit `.env`.

---

# 42. Agent Tool Architecture

Tools should use a consistent interface:

```text
name
description
input schema
execute()
```

Validate tool arguments before execution.

Every tool call should have:

- unique ID
- tool name
- input
- result/error
- timestamp if useful

Do not expose internal secrets.

---

# 43. Tool Iteration Safety

Maximum 8 iterations.

Example:

```text
Iteration 1 → search
Iteration 2 → analyze
Iteration 3 → search
Iteration 4 → generate artifact
Iteration 5 → final
```

At iteration 8, force termination and produce the best safe result available.

Never permit infinite loops.

---

# 44. Agent Context

Construct context from:

1. system instructions
2. selected mode
3. conversation history
4. relevant memory
5. current user message
6. available tools

Do not send unnecessary private data.

Limit conversation context intelligently to avoid excessive token usage.

---

# 45. Streaming

Streaming is preferred for long AI responses.

If streaming is implemented:

- stream safe text/events
- update terminal progressively
- keep UI responsive
- handle disconnects
- handle provider fallback
- finalize database state correctly

If streaming is unavailable for a specific provider, use normal request/response without breaking the application.

---

# 46. Duplicate Requests

Prevent accidental duplicate requests.

When request is active:

- disable Send
- allow Stop
- prevent repeated Enter presses from creating multiple requests

Backend should also use safe request handling where appropriate.

---

# 47. Network Recovery

If network temporarily fails:

- show connection error
- do not erase conversation
- allow retry

If streaming disconnects:

- preserve received content
- stop loading
- show reconnect/retry option when possible

---

# 48. UI Micro-Interactions

Use consistent reactions.

Buttons:

- hover → subtle background/border change
- active → pressed state
- disabled → muted state
- loading → spinner
- success → confirmation

Cards:

- subtle hover elevation
- no excessive movement

Panels:

- smooth transitions

Notifications:

- non-blocking toast where appropriate

Avoid excessive popups.

---

# 49. New Task

Clicking New Task should:

1. create a new conversation or reset current task
2. clear active execution state
3. clear artifact panel
4. focus the input
5. preserve previous conversations

Do not delete previous history.

---

# 50. Delete Conversation

Require deliberate interaction.

Show confirmation before deletion.

After deletion:

- remove it from sidebar
- select another conversation or empty state
- never accidentally delete unrelated data

Deletion must be authorized server-side.

---

# 51. Mobile Navigation

Mobile sidebar:

```text
☰ ZeroKore
```

Drawer contains navigation.

When an item is selected:

- close drawer
- navigate/update view

Artifact viewer should support horizontal scrolling for code.

Long AI messages should wrap correctly.

---

# 52. Desktop Panel Behavior

Allow reasonable resizing if practical.

Execution panel should remain usable even when artifact panel grows.

Avoid fixed pixel layouts that break at unusual resolutions.

Use flexible CSS grid/flex layouts.

---

# 53. State Management

Keep state modular.

Manage:

- authentication
- current conversation
- messages
- agent mode
- request status
- artifact
- provider status
- usage
- sidebar state

Avoid unnecessary global state.

Keep server state and UI state conceptually separate.

---

# 54. TypeScript

Use strict TypeScript.

Avoid:

```ts
any
```

unless absolutely unavoidable.

Define shared types for:

- messages
- conversations
- artifacts
- tools
- provider results
- agent events
- user profile
- usage

---

# 55. API Contract

## POST `/api/agent`

Input should contain only required user-controlled information such as:

```text
message
conversationId
mode
```

Server determines:

```text
userId
role
usage
memory
permissions
```

Flow:

1. authenticate
2. validate
3. rate limit
4. retrieve conversation
5. retrieve memory
6. run agent
7. execute tools
8. generate artifact if needed
9. save messages
10. return/stream result

---

# 56. Data Ownership

Every query involving user data must be scoped correctly.

Examples:

```text
messages → conversation owner
conversation → authenticated user
memory → authenticated user
usage → authenticated user
profile → authenticated user
```

Never accept ownership from frontend state alone.

---

# 57. Admin Architecture

Admin users may have:

- unlimited AI usage
- future administrative controls

Do not create client-side admin checks as the security boundary.

Frontend admin UI is only presentation.

Backend/database authorization remains authoritative.

---

# 58. Logging

Use safe structured logging.

Useful events:

```text
agent_started
provider_selected
provider_fallback
tool_started
tool_completed
artifact_generated
agent_completed
agent_failed
```

Do not log:

- API keys
- passwords
- auth tokens
- service credentials
- unnecessary private content

---

# 59. README

README must explain:

- what ZeroKore is
- architecture
- technology stack
- setup
- environment variables
- Supabase setup
- database schema
- authentication
- AI providers
- Tavily
- development commands
- production build
- security notes
- troubleshooting

Include clear setup instructions for someone cloning the project.

---

# 60. Installation

Install only necessary dependencies.

Before adding a package, determine whether an existing dependency or native platform feature can solve the requirement.

Avoid dependency bloat.

---

# 61. Build Sequence

Implement in this exact order:

### Phase 1 — Repository Inspection

Inspect the existing project first.

Determine:

- current files
- framework
- dependencies
- existing routes
- existing components
- existing environment configuration

Do not unnecessarily overwrite working code.

### Phase 2 — Foundation

Configure:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Lucide
- Framer Motion

Create base layout and theme.

### Phase 3 — Authentication

Implement:

- Supabase client/server
- signup
- login
- logout
- middleware
- protected dashboard

### Phase 4 — Database

Implement:

- schema
- extensions
- trigger
- RLS
- indexes
- ownership rules

### Phase 5 — Usage System

Implement:

- daily counter
- reset
- 15-request limit
- admin unlimited
- server-side enforcement

### Phase 6 — AI Cascade

Implement provider abstraction and fallback router.

Test each provider independently.

### Phase 7 — Agent

Implement:

- modes
- context
- memory
- tool execution
- iteration limit
- safe events
- final response

### Phase 8 — Tools

Implement:

- web search
- memory search
- artifact generation

### Phase 9 — Dashboard

Implement:

- sidebar
- header
- execution terminal
- toolbar
- artifact viewer
- responsive layouts

### Phase 10 — Conversations

Implement:

- create
- load
- save
- title
- delete
- history

### Phase 11 — Polish

Add:

- animations
- empty states
- loading states
- errors
- accessibility
- mobile optimization
- keyboard shortcuts

### Phase 12 — Testing

Test:

- authentication
- unauthorized access
- RLS
- usage limits
- admin behavior
- provider fallback
- tool failure
- memory failure
- artifact rendering
- mobile layout
- desktop layout
- network failure
- duplicate requests

### Phase 13 — Production Verification

Run:

```bash
npm run lint
npm run build
```

Fix every error.

Run the build again after fixes.

Do not declare completion while the production build is broken.

---

# 62. Testing Matrix

## Authentication

- signup works
- login works
- logout works
- invalid credentials handled
- protected routes protected

## Database

- schema applies
- trigger works
- RLS works
- cross-user access blocked

## AI

- Groq works
- fallback works
- DeepSeek works
- SambaNova works
- Gemini works
- all-provider failure handled

## Usage

- counter increments
- date resets
- 15th request works
- 16th request blocked
- admin unlimited

## Tools

- search success
- search unavailable
- memory success
- memory failure
- artifact generation
- invalid tool input
- iteration limit

## UI

Test:

- 320px mobile
- normal phone
- tablet
- 1366px desktop
- large monitor

Check for:

- overflow
- broken buttons
- unreadable text
- clipped panels
- inaccessible controls
- broken modals/drawers

---

# 63. Security Testing

Attempt to verify that:

- unauthenticated users cannot access dashboard data
- user A cannot access user B's conversations
- user A cannot access user B's memory
- client cannot change role
- service key never reaches browser
- provider keys never reach browser
- arbitrary HTML cannot escape iframe sandbox
- generated JS cannot execute in the main application
- malformed requests are rejected
- oversized requests are rejected
- tool loops terminate

---

# 64. Failure Philosophy

ZeroKore should degrade gracefully.

If one component fails, preserve the rest of the application whenever possible.

Examples:

```text
Memory fails
→ continue without memory

Tavily fails
→ continue without search

Provider 1 fails
→ provider 2

Provider 1–3 fail
→ provider 4

All providers fail
→ clean user-facing error

Artifact fails
→ return normal AI response

Database optional feature fails
→ do not crash unrelated UI
```

Never fake successful operations.

---

# 65. UX Principles

The user should always understand:

- what ZeroKore is doing
- whether it is loading
- which mode is active
- which provider is active when useful
- whether a tool is running
- whether an artifact was generated
- whether an error occurred
- whether the request was stopped

Avoid confusing technical errors.

Convert internal failures into concise user-facing messages.

---

# 66. Visual Feedback States

Define consistent states:

```text
IDLE
LOADING
THINKING
TOOL_RUNNING
FALLBACK
GENERATING
SUCCESS
ERROR
STOPPED
```

Each state should have a distinct but subtle UI indicator.

Never expose hidden reasoning.

---

# 67. Empty Workspace

Initial dashboard should look intentional rather than broken.

Show:

```text
ZERO KORE
Autonomous Intelligence Workspace

Choose a mode and start a task.
```

Provide suggested task cards such as:

```text
Build a website
Research a topic
Explain some code
Generate an SVG
```

Clicking a suggestion should populate the input rather than unexpectedly submit it.

---

# 68. Suggested Prompts

Suggested prompts should be:

- concise
- useful
- responsive
- keyboard accessible

On mobile, display fewer suggestions to preserve space.

---

# 69. Error Toasts

Use toast notifications for temporary events.

Examples:

```text
Conversation deleted.
Copied to clipboard.
Connection failed.
Memory saved.
```

Persistent errors should remain visible in the relevant panel.

---

# 70. Clipboard

Copy buttons must:

- use Clipboard API where available
- handle permission failure
- show success state
- not crash if clipboard is unavailable

Fallback gracefully.

---

# 71. Browser Compatibility

Target modern browsers.

Gracefully handle missing browser features.

Do not assume every API exists without checking where necessary.

---

# 72. Code Quality

Code must be:

- readable
- modular
- typed
- maintainable
- documented where complexity requires it

Avoid:

- duplicated logic
- giant components
- hardcoded secrets
- unnecessary abstractions
- dead code
- fake functionality

---

# 73. Component Principles

Each component should have a clear responsibility.

Example:

```text
Sidebar
→ navigation

Header
→ global dashboard controls

DualPanelCanvas
→ workspace layout

ExecutionTerminal
→ agent conversation/events

ArtifactViewer
→ artifact presentation

ToolBar
→ user task controls
```

---

# 74. Motion

Use Framer Motion for meaningful transitions:

- sidebar drawer
- panel appearance
- message appearance
- artifact appearance
- loading indicators

Respect:

```text
prefers-reduced-motion
```

When reduced motion is enabled, minimize or disable non-essential animation.

---

# 75. Mobile Keyboard Behavior

When the keyboard opens:

- input must remain visible
- avoid viewport jumping
- allow conversation scrolling
- keep send button accessible

Do not place essential controls beneath fixed browser/keyboard areas.

---

# 76. Long Content

For very long AI messages:

- wrap normal text
- code blocks scroll horizontally
- preserve performance
- avoid massive DOM rendering where possible

For large conversations, consider virtualization or incremental rendering if necessary.

---

# 77. Security of Generated Artifacts

Generated content is untrusted.

Treat all generated:

- HTML
- SVG
- Markdown
- code

as potentially unsafe.

Sanitize rendered content.

HTML must be sandboxed.

Do not execute generated code automatically.

Do not let generated content access:

- application cookies
- local storage containing secrets
- authentication state
- internal APIs

---

# 78. Environment Configuration

At startup, detect required configuration.

If optional credentials are missing:

```text
Tavily: Not configured
```

rather than pretending it works.

Required authentication/database configuration should produce clear setup errors.

---

# 79. Production Build

Before completion:

```bash
npm run lint
npm run build
```

Fix:

- TypeScript errors
- ESLint errors
- invalid imports
- server/client boundary issues
- environment errors
- build failures

Repeat until successful.

---

# 80. Final Acceptance Criteria

ZeroKore is complete only when:

- landing page works
- signup works
- login works
- logout works
- dashboard is protected
- Supabase database works
- RLS is active
- usage limits work
- admin unlimited access works
- AI cascade works
- provider fallback works
- agent modes work
- tools work
- memory works
- conversations work
- artifacts work
- safe previews work
- responsive UI works
- mobile navigation works
- loading states work
- error states work
- Stop works
- accessibility basics work
- secrets remain server-side
- no fake backend functionality exists
- no major console errors exist
- lint succeeds
- production build succeeds

---

# 81. Autonomous Coding-Agent Rules

If this specification is provided to an AI coding agent:

1. Inspect the repository before modifying it.
2. Preserve useful existing functionality.
3. Do not ask unnecessary questions.
4. Make reasonable implementation decisions independently.
5. Implement one subsystem at a time.
6. Keep the application runnable after major changes.
7. Never invent credentials.
8. Never hardcode secrets.
9. Never fake unavailable APIs.
10. Never expose chain-of-thought.
11. Never bypass authentication.
12. Never weaken RLS for convenience.
13. Never trust client-side authorization.
14. Test each subsystem after implementation.
15. Fix errors immediately.
16. Re-check responsive behavior after major UI changes.
17. Keep components modular.
18. Use strict TypeScript.
19. Document missing environment variables.
20. Run lint and production build before declaring completion.

If an external service is unavailable because credentials are missing, implement the integration correctly and clearly document the required environment variable instead of replacing it with fake data.

---

# 82. Definition of Done

The final ZeroKore experience should feel like a real autonomous AI development platform rather than a demo.

A user should be able to:

```text
Sign Up
  ↓
Log In
  ↓
Open Dashboard
  ↓
Choose Agent Mode
  ↓
Start Task
  ↓
ZeroKore Retrieves Memory
  ↓
AI Provider Responds
  ↓
Tools Run When Needed
  ↓
Provider Fallback Happens Automatically
  ↓
Execution Events Appear
  ↓
Final Answer Appears
  ↓
Artifact Appears When Generated
  ↓
Conversation Is Saved
  ↓
Useful Memory Can Persist
```

Every step must have appropriate loading, success, failure, responsive, and security behavior.

**Build ZeroKore as a complete product, not a visual prototype.**