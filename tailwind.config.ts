import type { Config } from "tailwindcss";

/** Build a Tailwind color that supports opacity modifiers from an RGB-triplet CSS var. */
function withVar(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

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
          bg: withVar("--kore-bg"),
          panel: withVar("--kore-panel"),
          panel2: withVar("--kore-panel2"),
          accent: withVar("--kore-accent"),
          accentDim: withVar("--kore-accentDim"),
          onAccent: withVar("--kore-onAccent"),
          text: withVar("--kore-text"),
          strong: withVar("--kore-strong"),
          muted: withVar("--kore-muted"),
          border: withVar("--kore-border"),
          danger: withVar("--kore-danger"),
          warn: withVar("--kore-warn"),
          success: withVar("--kore-success"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        glow: "var(--kore-glow-shadow)",
        panel: "var(--kore-panel-shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
