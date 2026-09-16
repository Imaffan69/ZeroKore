import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZeroKore — Autonomous Intelligence Workspace",
  description:
    "ZeroKore is a production-grade autonomous agentic AI platform: coding agent, research agent, tools, long-term memory, and artifacts — behind a clean, professional workspace.",
  applicationName: "ZeroKore",
  keywords: [
    "AI agent",
    "autonomous agent",
    "coding assistant",
    "research assistant",
    "artifacts",
    "vector memory",
  ],
  authors: [{ name: "ZeroKore" }],
  openGraph: {
    title: "ZeroKore — Autonomous Intelligence Workspace",
    description:
      "Coding agent, research agent, tools, memory, and artifacts in one professional workspace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${jbmono.variable} min-h-screen bg-kore-bg font-sans text-kore-text antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
