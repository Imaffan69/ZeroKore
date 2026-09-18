"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import SettingsPanel from "@/components/settings/SettingsPanel";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from "@/lib/preferences";
import { EASE } from "@/lib/motion";
import type { ProviderPreference, UsageState } from "@/types";
import type { ProjectPreferences } from "@/types";

/**
 * Settings screen.
 *
 * Reuses the existing SettingsPanel (account, models, integrations, system) and
 * adds the parts that need the session: live usage and persisted preferences.
 */
export default function SettingsScreen({ email }: { email: string }) {
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [preferences, setPreferences] =
    useState<ProjectPreferences>(DEFAULT_PREFERENCES);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        const data = await res.json();
        // The endpoint wraps the snapshot: { usage: { used, limit, unlimited } }.
        if (data?.usage) setUsage(data.usage as UsageState);
      } catch {
        // Usage simply stays unknown; nothing is faked.
      }
    })();
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const updatePreferences = useCallback((patch: Partial<ProjectPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      savePreferences(next);
      return next;
    });
  }, []);

  const providerLabel =
    preferences.preferredProvider === "auto"
      ? "Auto (fastest available)"
      : preferences.preferredProvider;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SettingsPanel
        email={email}
        usage={usage}
        provider={providerLabel}
        dbOk={true}
        preferredProvider={preferences.preferredProvider}
        onProviderChange={(p: ProviderPreference) => {
          updatePreferences({ preferredProvider: p });
          showToast(
            p === "auto"
              ? "Model set to Auto (fastest available)."
              : `Default model set to ${p}.`
          );
        }}
        onToast={showToast}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="glass glass-sheen fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm text-kore-text"
          >
            <CheckCircle2 className="h-4 w-4 text-white" aria-hidden />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}