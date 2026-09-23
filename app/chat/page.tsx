import type { Metadata } from "next";
import ProductPage from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Chat — talk to the agent | ZeroKore",
  description:
    "ZeroKore Chat: a conversation surface where the agent plans, calls tools, edits files and shows every step. Free while we grow.",
};

export default function ChatPage() {
  return (
    <ProductPage
      label="CHAT"
      title="A chat that"
      titleAccent="does the work."
      sub="Ask in plain words. The agent plans the change, picks its tools, writes real files and streams every step as it happens — with a hard ceiling so a run can never spiral."
      replaces={["ChatGPT Plus", "Copilot Pro", "Perplexity Pro", "Gemini Advanced"]}
      features={[
        {
          title: "Streaming transcript",
          body: "Tool calls, file writes, provider fallbacks and errors appear line by line as they happen. Nothing is hidden behind a spinner.",
        },
        {
          title: "@file to aim it",
          body: "Mention files with @ and their real contents are injected as context — the agent works on exactly what you pointed at.",
        },
        {
          title: "/skill to teach it",
          body: "Load a playbook with /skill-name: your team's conventions, style rules and workflows become part of that one conversation.",
        },
        {
          title: "Three honest modes",
          body: "Coding (with file tools), Research (web search + memory) and General (conversation). Each mode's toolset is visible in the toolbar.",
        },
        {
          title: "Pick the model",
          body: "Auto routes across four providers, or pin Groq / DeepSeek / SambaNova / Gemini and never get silently switched.",
        },
        {
          title: "Memory across projects",
          body: "The agent stores short facts it learns about your work and recalls them next time — visible and deletable in your account.",
        },
      ]}
      primaryCta="Open the chat"
      primaryHref="/dashboard"
      secondaryCta="Create an account"
      secondaryHref="/signup"
    />
  );
}
