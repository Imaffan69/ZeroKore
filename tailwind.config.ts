import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kore: {
          bg: "#090d16",
          panel: "#111827",
          panel2: "#0d1420",
          accent: "#10b981",
          accentDim: "#059669",
          text: "#e2e8f0",
          muted: "#94a3b8",
          border: "#1e293b",
          danger: "#ef4444",
          warn: "#f59e0b",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(16, 185, 129, 0.25)",
        panel: "0 8px 32px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;