"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogIn, GitBranch, FileText, Zap, Plus, CheckCircle } from "lucide-react";
import { fadeUp } from "@/lib/motion";

interface ActivityEvent {
  id: number;
  occurred_at: string;
  event: string;
  email: string;
  ip?: string | null;
  city?: string | null;
  country?: string | null;
  browser?: string | null;
}

interface ActivityFeedProps {
  username: string | null;
}

const eventIcons: Record<string, typeof LogIn> = {
  signup: LogIn,
  login: LogIn,
  project_created: GitBranch,
  project_deleted: FileText,
  import_started: GitBranch,
  token_saved: Zap,
  token_used: Zap,
  token_granted: Plus,
  username_set: CheckCircle,
};

export default function ActivityFeed({ username }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account/events");
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.events) ? data.events : [];
        setEvents(
          items
            .slice(0, 8)
            .map((e: Record<string, unknown>) => ({
              id: Number(e.id) || 0,
              occurred_at: String(e.occurred_at ?? ""),
              event: String(e.event ?? "login"),
              email: String(e.email ?? ""),
              ip: e.ip as string | null | undefined,
              city: e.city as string | null | undefined,
              country: e.country as string | null | undefined,
              browser: e.browser as string | null | undefined,
            }))
            .sort(
              (
                a: { occurred_at: string | null | undefined },
                b: { occurred_at: string | null | undefined }
              ) => new Date(b.occurred_at ?? "").getTime() - new Date(a.occurred_at ?? "").getTime()
            )
        );
      } catch {
        // Activity feed stays empty on error.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="glass glass-sheen rounded-2xl p-5">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" />
              <div className="flex-1 animate-pulse h-4 rounded bg-white/5" />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="glass glass-sheen rounded-2xl p-5">
        <p className="text-sm text-kore-muted">
          No recent activity to show. Your sign-ins and actions will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass glass-sheen rounded-2xl p-5">
      <div className="flex flex-col gap-3">
        {events.map((event, i) => {
          const Icon = eventIcons[event.event] ?? LogIn;
          const date = new Date(event.occurred_at);
          const timeStr = date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <motion.div
              key={event.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3"
            >
              <div className="shrink-0 mt-0.5 rounded-full bg-kore-accent/10 p-1.5">
                <Icon className="h-3.5 w-3.5 text-kore-accent" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">
                  <span className="font-medium capitalize">{event.event.replace(/_/g, " ")}</span>
                  {username && (
                    <span className="text-kore-muted">
                      {" "}
                      · @{username}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-kore-faint">
                  {timeStr}
                  {event.country && ` · ${event.country}`}
                  {event.city && `, ${event.city}`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}