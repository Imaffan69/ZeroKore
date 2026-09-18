import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ZeroKore — Autonomous Intelligence Workspace",
    template: "%s — ZeroKore",
  },
  description:
    "ZeroKore is a production-grade autonomous agentic AI platform: coding agent, research agent, tools, memory, and artifacts.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-kore-bg text-kore-text">
        {children}
      </body>
    </html>
  );
}