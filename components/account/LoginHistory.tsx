"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

interface LoginEvent {
  event: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  signup: "Signup",
  mfa_enroll: "MFA change",
  mfa_verify: "MFA verify",
  password_change: "Password change",
  session_revoke: "Sessions revoked",
};

/** The user's own security history: IP, approximate location, device. */
export default function LoginHistory() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/events");
      if (res.ok) setEvents((await res.json()).events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-kore-muted" aria-hidden />
        <p className="text-sm font-semibold text-white">Login history</p>
      </div>
      {loading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-kore-muted" />
      ) : events.length === 0 ? (
        <p className="mt-2 text-xs text-kore-muted">
          No security events recorded yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {events.map((e, i) => (
            <li key={i} className="glass-subtle rounded-xl px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-kore-text">
                  {EVENT_LABEL[e.event] ?? e.event}
                </span>
                <span className="font-mono text-[10px] text-kore-faint">
                  {e.created_at.slice(0, 16).replace("T", " ")}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-kore-muted">
                {[e.ip, [e.city, e.country].filter(Boolean).join(", ") || "unknown location", e.user_agent]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
