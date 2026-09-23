import type { Metadata } from "next";
import ProductPage from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "CLI — local agent tool | ZeroKore",
  description:
    "ZeroKore CLI: the local terminal companion. Designed, documented, and honest about its status.",
};

export default function CliPage() {
  return (
    <ProductPage
      label="CLI"
      title="The terminal companion,"
      titleAccent="for your machine."
      sub="A local tool that brings the same agent, skills and cascade to your own shell. This page documents it — the download isn't wired up yet, and we won't pretend otherwise."
      replaces={["OpenCode", "Codex CLI", "Claude Code", "Aider"]}
      features={[
        {
          title: "Same agent, local files",
          body: "The CLI talks to the same cascade router and skill library as the web workspace — pointed at folders on your machine instead of stored project files.",
        },
        {
          title: "Install command (once published)",
          body: "The intended install is a single line: npm i -g zerokore-cli, then kore . in any repo. Until that package exists, this command will fail — we say so here first.",
        },
        {
          title: "Status: designed, not shipped",
          body: "This is an honest placeholder. The web workspace at zerokore.vercel.app is fully functional today; the CLI will link here when it's real.",
        },
        {
          title: "Works with your skills",
          body: "Skills authored in the web app are the same markdown playbooks the CLI reads — one library, both surfaces.",
        },
        {
          title: "Local-first secrets",
          body: "The plan: provider keys load from your environment locally, never uploaded. Nothing about that is implemented until the package ships.",
        },
        {
          title: "Free, like everything here",
          body: "When it ships, the CLI spends from the same daily credit balance as the web — 30 free credits a day, every model.",
        },
      ]}
      primaryCta="Use the web workspace now"
      primaryHref="/dashboard"
      secondaryCta="Read the changelog"
      secondaryHref="/blog"
    />
  );
}
