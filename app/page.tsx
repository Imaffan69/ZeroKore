import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "ZeroKore — Autonomous agentic development workspace",
  description:
    "ZeroKore is a browser-based AI engineering environment: coding, research and planning agents, real file editing, bounded tool execution, persistent memory, artifacts and secure Git workflows.",
};

export default function HomePage() {
  return <LandingPage />;
}
