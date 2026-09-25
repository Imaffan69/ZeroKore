import type { Metadata } from "next";
import ProductPage from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Web — build apps in the browser | ZeroKore",
  description:
    "ZeroKore Web: a browser-based builder with a real editor, terminal, previews, secrets and a four-model AI agent. Free while we grow.",
};

export default function WebPage() {
  return (
    <ProductPage
      label="WEB"
      title="Build web apps"
      titleAccent="in the browser."
      sub="Start from a prompt or an empty folder. The agent writes real files, the editor saves them, the preview serves them — all inside one tab, with no install step."
      replaces={["Bolt", "Lovable", "v0", "Replit Agent"]}
      features={[
        {
          title: "Real files, not a sandbox",
          body: "Everything the agent writes lands in your project's file storage. Edit it yourself in Monaco, upload files, download a zip — the bytes are yours.",
        },
        {
          title: "Preview that actually runs",
          body: "Each project gets a served preview surface with its own environment. Save a file and the preview reflects it; secrets stay server-side.",
        },
        {
          title: "Git in both directions",
          body: "Import any repository you own, work on it here, then push changes back to a branch with a real commit message.",
        },
        {
          title: "Four-model cascade",
          body: "Groq, DeepSeek, SambaNova and Gemini sit behind one queue. Auto mode fails over when a provider is down; pinning keeps it pinned.",
        },
        {
          title: "Credits you can see",
          body: "One credit per request plus a small per-token meter, a visible balance, and a ledger entry for every grant — nothing hidden.",
        },
        {
          title: "Skills & mentions",
          body: "Type /skill-name to load a playbook into the agent, or @path/to/file to pin exactly which files it should work on.",
        },
      ]}
      primaryCta="Start building free"
      primaryHref="/signup"
      secondaryCta="See the workspace"
      secondaryHref="/dashboard"
    />
  );
}
