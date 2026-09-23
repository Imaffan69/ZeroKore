import type { Metadata } from "next";
import ProductPage from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Cloud — your GitHub workspace | ZeroKore",
  description:
    "ZeroKore Cloud: connect GitHub, import a repository, edit it with the agent and push changes back. Free while we grow.",
};

export default function CloudPage() {
  return (
    <ProductPage
      label="CLOUD"
      title="Your repo, in a"
      titleAccent="cloud workspace."
      sub="Connect GitHub once, pick any repository you own, and it arrives as a real project: files, folders, branch. The agent edits it, the terminal touches it, and you push it back when it's right."
      replaces={["Devin", "Factory", "Cursor Cloud", "GitHub Codespaces"]}
      features={[
        {
          title: "Connect in one click",
          body: "OAuth into GitHub and the repository picker lists everything you can access — private repos included, with the lock icon where it applies.",
        },
        {
          title: "Import any text-based repo",
          body: "Code, configs, docs, CI files — anything a text editor can open arrives editable. Binary assets come as-is but are honestly not editable here.",
        },
        {
          title: "Push to a branch you choose",
          body: "After the agent changes files, push them back with an explicit commit message. Failures are reported per file — never silently.",
        },
        {
          title: "Secrets stay on the server",
          body: "Environment variables are AES-256-GCM encrypted at rest, read only inside API routes, and never returned to the browser.",
        },
        {
          title: "Real shell over project files",
          body: "ls, cat, grep, tree, mv, echo > — every command runs against the project's actual stored files with real output and real errors.",
        },
        {
          title: "History you can audit",
          body: "Agent edits snapshot the previous content, so the Changes tab shows a true +/− diff for every file, every time.",
        },
      ]}
      primaryCta="Connect GitHub"
      primaryHref="/api/github/oauth"
      secondaryCta="Start without GitHub"
      secondaryHref="/signup"
    />
  );
}
