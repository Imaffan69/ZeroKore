import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowLeft, FileText, Terminal } from "lucide-react";
import { listSkills, getSkill } from "@/lib/skills";
import { renderSafeMarkdown } from "@/lib/markdown";
import { getSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Skills — ZeroKore",
  description:
    "The playbooks the ZeroKore agent loads on demand with /skill-name: design, motion, accessibility, review and more.",
};

export const dynamic = "force-dynamic";

/**
 * Skills browser.
 *
 * Reads the committed `.claude/skills/<name>/SKILL.md` files straight from the
 * repository — the same files the agent loads when you type `/skill-name`. The
 * body is rendered with the shared safe-markdown renderer, so nothing here can
 * inject markup. Gated behind a session like the skills API.
 */
export default async function SkillsPage() {
  const session = await getSession();
  const summaries = await listSkills();
  const details = await Promise.all(summaries.map((s) => getSkill(s.name)));

  return (
    <main className="min-h-dvh w-full bg-black text-kore-text">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-kore-muted transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to workspace
        </Link>

        {session && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <span className="font-mono text-[10px] tracking-wide text-kore-faint">
              SIGNED IN
            </span>
            <p className="mt-1 font-medium text-white break-all">{session.email}</p>
            <Link
              href="/dashboard"
              className="mt-2 inline-flex items-center gap-1 text-kore-accent hover:underline"
            >
              Open workspace
              <ArrowLeft className="h-3 w-3 rotate-180" aria-hidden />
            </Link>
          </div>
        )}

        <header className="mt-6">
          <p className="font-mono text-[10px] tracking-[0.24em] text-kore-muted">
            AGENT KNOWLEDGE
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
            Skills
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-kore-muted">
            A skill is a markdown playbook committed with the repository. Type{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white">
              /skill-name
            </code>{" "}
            at the start of a message and the agent loads that playbook into its
            context before planning. {summaries.length} skills ship with this
            deployment.
          </p>
        </header>

        <section className="mt-8 space-y-3">
          {summaries.map((skill, i) => {
            const detail = details[i];
            return (
              <details
                key={skill.name}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] open:bg-white/[0.04]"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-5 py-4 transition hover:bg-white/[0.03]">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-kore-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      {skill.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-kore-muted">
                      {skill.description || "No description in frontmatter."}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-kore-faint">
                      <span className="inline-flex items-center gap-1">
                        <Terminal className="h-3 w-3" aria-hidden />/{skill.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" aria-hidden />
                        {(skill.bytes / 1024).toFixed(1)} KB
                      </span>
                      {skill.resourceCount > 0 && (
                        <span>{skill.resourceCount} supporting files</span>
                      )}
                    </span>
                  </span>
                </summary>

                <div className="border-t border-white/10 px-5 py-4">
                  {detail?.resourceNames?.length ? (
                    <p className="mb-3 font-mono text-[10px] text-kore-faint">
                      ships with: {detail.resourceNames.join(" · ")}
                    </p>
                  ) : null}
                  {detail?.content ? (
                    <div
                      className="md-body max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: renderSafeMarkdown(detail.content),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-kore-muted">
                      This skill has no readable body on disk.
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </section>
      </div>
    </main>
  );
}
