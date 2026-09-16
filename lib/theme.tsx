"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_KEY = "zerokore-theme";

interface ThemeContextValue {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** No-flash bootstrap script — runs before paint in the document head. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t?(t==='dark'||(t==='system'&&m)):true;var el=document.documentElement;el.classList.toggle('dark',dark);el.style.colorScheme=dark?'dark':'light';}catch(e){document.documentElement.classList.add('dark');}})();`;

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: Theme): Resolved {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function apply(resolved: Resolved) {
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<Resolved>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    setThemeState(stored);
    const r = resolve(stored);
    setResolved(r);
    apply(r);
  }, []);

  // Keep in sync with OS changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: Resolved = mq.matches ? "dark" : "light";
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    const r = resolve(t);
    setResolved(r);
    apply(r);
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

const OPTIONS: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** Compact icon button that cycles dark → light → system. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolved, setTheme } = useTheme();
  const next: Theme =
    theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const Icon = theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <button
      onClick={() => setTheme(next)}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border border-kore-border text-kore-muted transition hover:border-kore-accent/50 hover:text-kore-strong",
        className
      )}
      title={`Theme: ${theme} (click for ${next})`}
      aria-label={`Switch theme, currently ${theme}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** Three-segment control (Light / Dark / System) for settings surfaces. */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      className="inline-flex rounded-lg border border-kore-border bg-kore-bg p-1"
      role="group"
      aria-label="Theme preference"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setTheme(o.id)}
          aria-pressed={theme === o.id}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
            theme === o.id
              ? "bg-kore-accent text-kore-onAccent shadow-sm"
              : "text-kore-muted hover:text-kore-strong"
          )}
        >
          <o.icon className="h-4 w-4" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}
