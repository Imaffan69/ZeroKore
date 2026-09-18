import type { ProjectPreferences } from "@/types";

/**
 * Client-side workspace preferences (project name, pinned model, motion).
 * Stored in localStorage — these are UI/project preferences only and never
 * contain secrets. Defaults keep the workspace usable on first run.
 */
const STORAGE_KEY = "zerokore.preferences.v1";

export const DEFAULT_PREFERENCES: ProjectPreferences = {
  projectName: "ZeroKore",
  preferredProvider: "auto",
  reducedMotion: false,
};

export function loadPreferences(): ProjectPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<ProjectPreferences>;
    return {
      projectName:
        typeof parsed.projectName === "string" && parsed.projectName.trim()
          ? parsed.projectName.slice(0, 40)
          : DEFAULT_PREFERENCES.projectName,
      preferredProvider:
        parsed.preferredProvider === "auto" ||
        parsed.preferredProvider === "Groq" ||
        parsed.preferredProvider === "DeepSeek" ||
        parsed.preferredProvider === "SambaNova" ||
        parsed.preferredProvider === "Gemini"
          ? parsed.preferredProvider
          : DEFAULT_PREFERENCES.preferredProvider,
      reducedMotion: !!parsed.reducedMotion,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: ProjectPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable (private mode); preferences are best-effort.
  }
}
