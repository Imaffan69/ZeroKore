/**
 * Single source of truth for the app version + release notes.
 * Surfaced in the landing footer, sidebar, and the About panel.
 */
export const APP_VERSION = "2.0.0";
export const APP_CODENAME = "Aurora";
export const APP_BUILD_DATE = "2026-09-16";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.0.0",
    date: "2026-09-16",
    title: "Aurora — professional redesign",
    notes: [
      "New clean-neutral design system with VS Code-style light & dark themes",
      "iOS-style frosted glass surfaces across navigation and overlays",
      "Google sign-in added alongside email + password",
      "Command palette (Cmd/Ctrl+K) for fast navigation and actions",
      "System theme detection with a persisted preference",
      "About & version panel with live release notes",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-01",
    title: "Initial autonomous workspace",
    notes: [
      "Coding, research, and general agent modes",
      "Provider cascade: Groq → DeepSeek → SambaNova → Gemini",
      "Long-term pgvector memory scoped per user",
      "Artifact generation with sandboxed previews",
      "Supabase Auth with Row Level Security and daily usage limits",
    ],
  },
];
