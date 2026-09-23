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
          bg: "#000000",
          panel: "#0a0a0a",
          panel2: "#050505",
          accent: "#b5cfa0",
          accentDim: "#8fbf7f",
          mint: "#4ade80",
          text: "#f4f4f6",
          body: "#d7d7dc",
          muted: "#b8b8c0",
          faint: "#8a8a93",
          border: "rgba(255,255,255,0.10)",
          danger: "#ef4444",
          warn: "#f59e0b",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 255, 255, 0.12)",
        panel: "0 8px 32px rgba(0, 0, 0, 0.45)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        glassHover: "0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
      },
      backdropBlur: {
        xs: "2px",
        sm: "6px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;