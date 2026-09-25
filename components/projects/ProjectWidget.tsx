"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FolderOpen, FolderPlus, Github, ArrowRight, Trash2 } from "lucide-react";
import { EASE, fadeUp, hoverLift, press } from "@/lib/motion";
import { formatWhen } from "@/lib/slug";
import type { Project } from "@/types/projects";
import { projectPath } from "@/lib/slug";

const SOURCE_LABEL: Record<Project["source"], string> = {
  created: "Created here",
  github: "GitHub",
  imported: "Imported",
};

/** One project as an iOS-style glass widget on the navigator. */
export default function ProjectWidget({
  project,
  username,
  onDelete,
}: {
  project: Project;
  username: string | null;
  onDelete: (slug: string, name: string) => void;
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={hoverLift}
      className="glass glass-sheen glass-interactive flex flex-col rounded-2xl p-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <FolderOpen className="h-4 w-4 text-kore-text" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold text-white"
            title={project.name}
          >
            {project.name}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-kore-muted">
            /projects/{project.slug}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-kore-muted">
        {project.description || "No description yet."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="glass-subtle inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] text-kore-muted">
          {project.source === "github" ? (
            <Github className="h-2.5 w-2.5" aria-hidden />
          ) : (
            <FolderPlus className="h-2.5 w-2.5" aria-hidden />
          )}
          {SOURCE_LABEL[project.source]}
        </span>
        <span className="font-mono text-[10px] text-kore-muted">
          updated {formatWhen(project.updated_at)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={projectPath(username, project.slug)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          Open project
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <motion.button
          whileTap={press}
          transition={{ duration: 0.12, ease: EASE }}
          onClick={() => onDelete(project.slug, project.name)}
          className="rounded-full p-2 text-kore-muted transition-colors duration-150 hover:bg-kore-danger/15 hover:text-red-300"
          aria-label={`Delete project ${project.name}`}
          title="Delete project"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </motion.button>
      </div>
    </motion.div>
  );
}