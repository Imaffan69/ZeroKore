"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FolderPlus,
  Github,
  FolderOpen,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE, fadeUp, hoverLift, press, staggerGroup } from "@/lib/motion";
import ProjectWidget from "./ProjectWidget";
import CreateProjectPanel from "./CreateProjectPanel";
import ImportRepoPanel from "./ImportRepoPanel";
import type { Project } from "@/types/projects";

/**
 * The workspace navigator.
 *
 * The dashboard is a chooser, not a canvas: create a project, import one from
 * GitHub, or continue an existing one. Every project owns its own URL, so
 * "open" is a real navigation rather than a state change.
 */

type Mode = "browse" | "create" | "import";

const ACTIONS = [
  {
    id: "create" as Mode,
    icon: FolderPlus,
    title: "Create a project",
    body: "Start from an empty workspace with files, a preview, a terminal and secrets.",
  },
  {
    id: "import" as Mode,
    icon: Github,
    title: "Import from GitHub",
    body: "Pull a repository you own into a project you can edit and push back.",
  },
  {
    id: "browse" as Mode,
    icon: FolderOpen,
    title: "Continue a project",
    body: "Reopen your work with its files, environments and history intact.",
  },
] as const;

export default function ProjectsNavigator({
  email,
  username,
}: {
  email: string;
  username: string | null;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("browse");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) {
        setListError(
          data?.error ?? "We couldn't load your projects. Try again in a moment."
        );
        setProjects([]);
        return;
      }
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      setListError(null);
    } catch {
      setListError("Connection failed while loading projects.");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function deleteProject(slug: string, projectName: string) {
    if (
      !window.confirm(
        `Delete "${projectName}"? Its files, environments and secrets are removed. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Could not delete that project.");
        return;
      }
      setProjects((prev) => (prev ?? []).filter((p) => p.slug !== slug));
      showToast(`Deleted "${projectName}".`);
    } catch {
      showToast("Connection failed while deleting the project.");
    }
  }

  const count = projects?.length ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-10 sm:px-8">
        <motion.header
          variants={staggerGroup(0.07)}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <motion.p
              variants={fadeUp}
              className="font-mono text-[10px] tracking-[0.24em] text-kore-muted"
            >
              WORKSPACE
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl"
            >
              Your projects
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-2 max-w-xl text-sm leading-relaxed text-kore-muted"
            >
              Start something new, import a repository you already own, or pick up
              where you left off. Each project keeps its own files, environments
              and memory at its own URL.
            </motion.p>
          </div>
          <motion.p
            variants={fadeUp}
            className="font-mono text-[11px] text-kore-muted"
            title={email}
          >
            {username ? (
              <>
                zerokore.vercel.app/
                <span className="text-white">{username}</span>
              </>
            ) : (
              email
            )}
          </motion.p>
        </motion.header>

        <motion.div
          variants={staggerGroup(0.06, 0.1)}
          initial="hidden"
          animate="visible"
          className="mt-7 grid gap-3 sm:grid-cols-3"
        >
          {ACTIONS.map((action) => {
            const active = mode === action.id;
            return (
              <motion.button
                key={action.id}
                variants={fadeUp}
                whileHover={hoverLift}
                whileTap={press}
                onClick={() => setMode(action.id)}
                aria-pressed={active}
                className={cn(
                  "glass glass-sheen glass-interactive rounded-2xl p-4 text-left",
                  active && "ring-1 ring-white/25"
                )}
              >
                <span className="glass-subtle mb-3 flex h-9 w-9 items-center justify-center rounded-xl">
                  <action.icon className="h-4 w-4 text-white" aria-hidden />
                </span>
                <span className="block text-sm font-semibold text-white">
                  {action.title}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-kore-muted">
                  {action.body}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] tracking-wide text-kore-muted">
                  {action.id === "browse"
                    ? `${count} project${count === 1 ? "" : "s"}`
                    : "open"}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === "create" && (
            <CreateProjectPanel
              key="create"
              username={username}
              onCancel={() => setMode("browse")}
            />
          )}
          {mode === "import" && (
            <ImportRepoPanel
              key="import"
              username={username}
              onCancel={() => setMode("browse")}
            />
          )}
        </AnimatePresence>

        <section className="mt-9" aria-label="Your projects">
          <div className="mb-3.5 flex items-center gap-2">
            <h2 className="font-mono text-[10px] tracking-[0.2em] text-kore-muted">
              CONTINUE A PROJECT
            </h2>
            {count > 0 && (
              <span className="font-mono text-[10px] text-kore-muted/70">
                {count}
              </span>
            )}
          </div>

          {listError && (
            <p
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-2.5 text-sm text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {listError}
            </p>
          )}

          {projects === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="glass-subtle h-40 animate-pulse rounded-2xl"
                  aria-hidden
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="glass-subtle rounded-2xl px-6 py-10 text-center"
            >
              <FolderOpen
                className="mx-auto mb-3 h-5 w-5 text-kore-muted"
                aria-hidden
              />
              <p className="text-sm font-medium text-kore-text">No projects yet</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-kore-muted">
                Your projects appear here, each with its own URL, files and
                environments. Create one above, or import a repository from GitHub.
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={staggerGroup(0.05)}
              initial="hidden"
              animate="visible"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {projects.map((project) => (
                <ProjectWidget
                  key={project.id}
                  project={project}
                  username={username}
                  onDelete={deleteProject}
                />
              ))}
            </motion.div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="glass glass-sheen fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-sm text-kore-text"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-white" aria-hidden />
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}