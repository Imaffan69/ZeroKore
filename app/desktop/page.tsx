import type { Metadata } from "next";
import ProductPage from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Desktop — local app | ZeroKore",
  description:
    "ZeroKore Desktop: the local workspace app. Designed, documented, honest about status.",
};

export default function DesktopPage() {
  return (
    <ProductPage
      label="DESKTOP"
      title="The workspace,"
      titleAccent="as a desktop app."
      sub="A local window onto the same projects, agent and skills — for people who live in a dock icon. This page describes the plan honestly: the app isn't built yet, the web workspace is."
      replaces={["VS Code + Copilot", "Cursor", "Windsurf", "Zed"]}
      features={[
        {
          title: "Same projects, native window",
          body: "The intended experience: your ZeroKore projects open in a desktop frame with the same editor, terminal and Changes tab.",
        },
        {
          title: "Status: not shipped yet",
          body: "No download exists today. Any button that claimed to download an app would be lying — so this one links to the working web app instead.",
        },
        {
          title: "Editor you already know",
          body: "Monaco — the editor VS Code is built on — is already in the web workspace, so the desktop version starts from familiarity.",
        },
        {
          title: "Offline read, online agent",
          body: "Planned: files readable offline; agent runs and Git operations happen when you're connected, with queued retries.",
        },
        {
          title: "Skills travel with you",
          body: "The same SKILL.md playbooks power web, CLI and desktop — author once, load anywhere with /skill-name.",
        },
        {
          title: "Notifications for agent runs",
          body: "Planned: a native notification when a long run finishes or asks for a decision — instead of watching a spinner.",
        },
      ]}
      primaryCta="Use the web workspace now"
      primaryHref="/dashboard"
      secondaryCta="Join the waitlist"
      secondaryHref="/signup"
    />
  );
}
