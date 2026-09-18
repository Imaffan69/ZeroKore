"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FolderPlus, Loader2, X } from "lucide-react";
import { EASE, press } from "@/lib/motion";
import { slugify } from "@/lib/slug";

/** Create-project panel: name becomes the project's URL. */
export default function CreateProjectPanel({
  onCancel,
}: {
  onCancel: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = slugify(name || "my-project").slice(0, 40);

  async function submit() {
    if (!name.trim()) {
      setError("Give the project a name so it has a URL.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not create the project.");
        return;
      }
      router.push(`/projects/${data.project.slug}`);
    } catch {
      setError("Connection failed while creating the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="glass glass-sheen mt-4 rounded-2xl p-5"
      aria-label="Create a project"
    >
      <h2 className="text-sm font-semibold text-white">New project</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-kore-muted">
        You&apos;ll get files, a preview, a terminal and secrets at{" "}
        <span className="font-mono text-kore-text">/projects/{slugPreview}</span>.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="proj-name" className="mb-1.5 block text-xs text-kore-text">
            Project name
          </label>
          <input
            id="proj-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Landing page"
            className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2 text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="proj-desc" className="mb-1.5 block text-xs text-kore-text">
            Description <span className="text-kore-muted">(optional)</span>
          </label>
          <input
            id="proj-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 400))}
            placeholder="What are you building?"
            className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2 text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-2.5 text-sm text-red-300"
        >
          <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <motion.button
          whileTap={press}
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150 hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FolderPlus className="h-3.5 w-3.5" aria-hidden />
          )}
          Create project
        </motion.button>
        <button
          onClick={onCancel}
          className="rounded-full px-3.5 py-2 text-xs text-kore-muted transition-colors duration-150 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </motion.section>
  );
}