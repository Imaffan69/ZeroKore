import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Blog — ZeroKore",
  description: "Guides, comparisons and product updates from the ZeroKore team.",
};

export const dynamic = "force-dynamic";

/** Category filter tabs: All + the four real content categories. */

/** Seed posts ship with the page; admin announcements come from the DB. */
const SEED_POSTS: {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
}[] = [
  {
    slug: "free-forever",
    category: "Announcements",
    title: "ZeroKore is free: 30 credits every day, every model",
    excerpt:
      "No trial, no card. Credits meter real usage — one request plus a small per-token charge — and reset at midnight UTC. Here is exactly how it works.",
    date: "2026-09-20",
  },
  {
    slug: "agent-file-tools",
    category: "Engineering",
    title: "How the agent edits your files: versions, diffs, and the Changes tab",
    excerpt:
      "Every agent edit snapshots the previous content, so the Changes tab can show a true +/− diff per file. A look at the edit pipeline.",
    date: "2026-09-18",
  },
  {
    slug: "cascade-routing",
    category: "Engineering",
    title: "Four providers, one cascade: staying alive when a model dies",
    excerpt:
      "Model ids get retired without notice. ZeroKore walks Groq → DeepSeek → SambaNova → Gemini on retryable errors so your run survives.",
    date: "2026-09-15",
  },
  {
    slug: "zero-vs-copilot",
    category: "Comparisons",
    title: "ZeroKore vs Copilot Pro vs Cursor: what $0 actually gets you",
    excerpt:
      "A comparison across agent autonomy, file editing, project workspaces and price. Spoiler: the free tier here does things paid tiers elsewhere don't.",
    date: "2026-09-12",
  },
  {
    slug: "skills",
    category: "Guides",
    title: "Skills: teaching the agent your team's playbook",
    excerpt:
      "Type /skill-name in any chat and the agent loads that playbook into context. How to write a good SKILL.md.",
    date: "2026-09-08",
  },
];

interface Announcement {
  id: string;
  title: string;
  body: string;
  version: string | null;
  created_at: string;
}

export default async function BlogPage() {
  let announcements: Announcement[] = [];
  try {
    // RLS on `announcements` intentionally exposes no policy to anon or
    // authenticated clients, so the session client returned nothing here and
    // every admin post stayed invisible on the public blog. The service client
    // reads only `active = true` rows, which is all a public page may show —
    // drafts and inactive announcements still never leak.
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, version, created_at")
      .eq("active", true)
      .in("kind", ["post", "changelog"])
      .order("created_at", { ascending: false })
      .limit(10);
    announcements = data ?? [];
  } catch {
    announcements = [];
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
      <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">BLOG</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
        Notes from the build.
      </h1>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Categories">
        {["All", "Announcements", "Comparisons", "Guides", "Engineering"].map((c) => (
          <span
            key={c}
            role="tab"
            aria-selected={c === "All"}
            className={
              c === "All"
                ? "rounded-full bg-white px-3.5 py-1.5 font-mono text-[10px] tracking-[0.14em] text-black"
                : "rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.14em] text-kore-muted"
            }
          >
            {c.toUpperCase()}
          </span>
        ))}
      </div>

      <div className="mt-10 space-y-4">
        {announcements.map((a) => (
          <article key={a.id} className="glass glass-sheen rounded-2xl border border-kore-accent/30 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-kore-accent/15 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-kore-accent">
                ANNOUNCEMENT
              </span>
              {a.version && (
                <span className="font-mono text-[10px] text-kore-muted">{a.version}</span>
              )}
              <span className="font-mono text-[10px] text-kore-faint">
                {a.created_at.slice(0, 10)}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">{a.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-kore-muted">
              {a.body.slice(0, 400)}
              {(a.body.length ?? 0) > 400 ? "…" : ""}
            </p>
          </article>
        ))}

        {SEED_POSTS.map((p) => (
          <article key={p.slug} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/8 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-kore-muted">
                {p.category.toUpperCase()}
              </span>
              <span className="font-mono text-[10px] text-kore-faint">{p.date}</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-kore-muted">{p.excerpt}</p>
          </article>
        ))}
      </div>

      <p className="mt-10 text-xs text-kore-muted">
        Product questions? The{" "}
        <Link href="/pricing" className="text-kore-accent hover:underline">
          pricing page
        </Link>{" "}
        explains credits; the feedback widget reaches the team directly.
      </p>
    </main>
  );
}
