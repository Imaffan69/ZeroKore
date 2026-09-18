# ZeroKore Skills

Project-local agent skills live in `.claude/skills/`, one folder per skill:

```
.claude/skills/<skill-name>/SKILL.md
```

That layout is what the skills UI scans, so these files travel with the repo and
are available to anyone working on ZeroKore. Invoke one in chat by typing `/`.

## Current skills

| Skill | Use it for |
|---|---|
| `design-motion-principles` | Motion/interaction design — creating or auditing animation |
| `vercel-react-best-practices` | React/Next.js performance rules (waterfalls, bundles, re-renders) |
| `vercel-composition-patterns` | Component architecture: compound components, avoiding boolean props |
| `vercel-react-view-transitions` | View Transitions API patterns in React |
| `shadcn` | shadcn/ui component usage and conventions |
| `better-accessibility` | Accessibility audits and fixes |
| `ux-writing` | Microcopy: buttons, errors, empty states, onboarding |
| `create-design-md` | Producing a DESIGN.md design-system document |
| `requesting-code-review` | Structuring a code-review request |
| `dispatching-parallel-agents` | Splitting work across parallel agents |
| `using-superpowers` | Meta-guidance for using skills well |
| `vibe-coding` | Coaching non-engineers building with AI |

## Adding a skill

1. **Markdown skill** — create the folder matching the skill name and put the
   markdown inside:

   ```
   .claude/skills/my-skill/SKILL.md
   ```

2. **Zip skill** — unzip it first, then copy the extracted folder in. Keep the
   original zip outside the repo (e.g. `~/Downloads/skills-archive/`) as backup.

## Tips

- One folder per skill; the file must be named `SKILL.md`.
- Frontmatter should include `name` and `description` — the description is what
  tells the agent when the skill applies, so make it specific and trigger-rich.
- These files are committed with the repo, so everyone gets them.
- For skills you want in *every* project, keep them in your user-level skills
  directory on your own machine instead.
