"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileCode2,
  Folder,
  Terminal as TerminalIcon,
  GitCompareArrows,
  Eye,
} from "lucide-react";
import { EASE } from "@/lib/motion";

/**
 * An interactive product demo, not a screenshot.
 *
 * The page previously showed a static mock, which read as a portfolio piece: a
 * picture of software. This is a working miniature of the real workspace — the
 * tabs switch, the agent narrates, the terminal runs a command, the diff counts
 * lines — so a visitor can operate the product before signing up.
 *
 * It is honest about being a demo: nothing here is wired to a backend, and no
 * button pretends to be a feature.
 */

type Tab = "preview" | "code" | "terminal" | "changes";

const TABS: { id: Tab; label: string; icon: typeof Eye }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: FileCode2 },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "changes", label: "Changes", icon: GitCompareArrows },
];

const TREE = [
  { name: "app", depth: 0, dir: true },
  { name: "api", depth: 2, dir: true },
  { name: "route.ts", depth: 3, active: true },
  { name: "layout.tsx", depth: 2 },
  { name: "globals.css", depth: 1 },
  { name: "lib", depth: 0, dir: true },
  { name: "agent.ts", depth: 1 },
  { name: "skills.ts", depth: 1 },
  { name: "package.json", depth: 0 },
];

const CODE = [
  { n: 41, text: "export async function POST(req: Request) {", add: false },
  { n: 42, text: "  const { user } = await requireUser();", add: false },
  { n: 43, text: "  const body = await readJson(req);", add: false },
  { n: 44, text: "", add: true },
  { n: 45, text: "  // never trust a client-supplied owner id", add: true },
  { n: 46, text: "  const project = await getProject(body.slug, user.id);", add: true },
  { n: 47, text: "  if (!project) throw new NotFound();", add: true },
  { n: 48, text: "", add: true },
  { n: 49, text: "  return NextResponse.json({ ok: true });", add: false },
  { n: 50, text: "}", add: false },
];

/** The agent's narration, revealed one line at a time, then held. */
const STEPS = [
  "Mapped 34 files · found the project route",
  "read app/api/projects/[slug]/route.ts",
  "Security: slug resolved without an owner check",
  "write_file · +7 −1",
  "run_shell · tsc --noEmit → clean",
];

export default function ProductDemo() {
  const [tab, setTab] = useState<Tab>("preview");
  const [step, setStep] = useState(0);

  // Auto-advance through the agent's steps once, then leave the result visible.
  useEffect(() => {
    if (step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [step]);


  return (
    <div className="glass overflow-hidden rounded-2xl shadow-2xl shadow-black">
      {/* chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
        <span className="ml-3 truncate font-mono text-[10px] text-kore-muted">
          zerokore.vercel.app/&lt;you&gt;/my-app
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-[#4ade80]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" aria-hidden />
          live
        </span>
      </div>

      {/* tabs — real switching, not decoration */}
      <div
        className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 pt-2"
        role="tablist"
        aria-label="Workspace panels"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-[11px] transition ${
              tab === id
                ? "bg-white/[0.07] text-white"
                : "text-kore-muted hover:text-white"
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-[19rem] grid-cols-1 sm:grid-cols-[9.5rem_1fr]">
        {/* file tree */}
        <aside className="hidden border-r border-white/10 p-2.5 sm:block">
          <p className="mb-2 px-1 font-mono text-[9px] tracking-[0.2em] text-kore-muted">
            EXPLORER
          </p>
          <ul className="space-y-px">
            {TREE.map((f) => (
              <li
                key={f.name}
                className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] ${
                  f.active ? "bg-white/[0.08] text-white" : "text-kore-muted"
                }`}
                style={{ paddingLeft: 6 + f.depth * 8 }}
              >
                {f.dir ? (
                  <Folder className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <FileCode2 className="h-3 w-3 shrink-0" aria-hidden />
                )}
                <span className="truncate">{f.name}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* panel */}
        <div className="min-w-0 p-3.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {tab === "preview" && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[9px] tracking-[0.2em] text-kore-muted">
                    AGENT
                  </p>
                  {STEPS.slice(0, step).map((s, i) => (
                    <motion.p
                      key={s}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`font-mono text-[11px] leading-relaxed ${
                        i === step - 1 ? "text-white" : "text-kore-muted"
                      }`}
                    >
                      <span className="text-[#b5cfa0]">&rsaquo;</span> {s}
                    </motion.p>
                  ))}
                  {step < STEPS.length && (
                    <span className="inline-block h-3 w-1.5 animate-pulse bg-[#4ade80]" />
                  )}
                </div>
              )}

              {tab === "code" && (
                <pre className="overflow-x-auto font-mono text-[10.5px] leading-relaxed">
                  {CODE.map((l) => (
                    <div
                      key={l.n}
                      className={
                        l.add ? "bg-[#4ade80]/10 text-[#b5cfa0]" : "text-kore-muted"
                      }
                    >
                      <span className="mr-3 inline-block w-6 select-none text-right opacity-50">
                        {l.n}
                      </span>
                      {l.add && <span className="mr-1 text-[#4ade80]">+</span>}
                      {l.text || " "}
                    </div>
                  ))}
                </pre>
              )}

              {tab === "terminal" && (
                <div className="space-y-1 font-mono text-[10.5px] leading-relaxed">
                  <p className="text-kore-muted">
                    <span className="text-[#4ade80]">$</span> npx tsc --noEmit
                  </p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[#b5cfa0]"
                  >
                    no type errors
                  </motion.p>
                  <p className="pt-1 text-kore-muted">
                    <span className="text-[#4ade80]">$</span>{" "}
                    <span className="inline-block h-3 w-1.5 animate-pulse bg-[#4ade80]" />
                  </p>
                </div>
              )}

              {tab === "changes" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 font-mono text-[10px]">
                    <span className="truncate text-white">
                      app/api/projects/[slug]/route.ts
                    </span>
                    <span className="shrink-0">
                      <span className="text-[#4ade80]">+7</span>{" "}
                      <span className="text-red-400">&minus;1</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "78%" }}
                      transition={{ duration: 0.7, ease: EASE }}
                      className="h-full rounded-full bg-gradient-to-r from-[#4ade80] to-[#b5cfa0]"
                    />
                  </div>
                  <p className="font-mono text-[10px] text-kore-muted">
                    working directory &middot; 1 file changed
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
