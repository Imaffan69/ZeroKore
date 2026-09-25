"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogIn, GitBranch, FileText, Zap, Plus, CheckCircle } from "lucide-react";
import { fadeUp } from "@/lib/motion";

interface ActivityEvent {
  event: string;
  ip?: string | null;
  city?: string | null;
  country?: string | null;
  userAgent?: string | null;
  createdAt?: string | null;
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
              // These are the column names /api/account/events actually selects.
              // The feed previously read `occurred_at`, `email` and `browser`,
              // none of which exist on login_events, so every row rendered blank.
              event: String(e.event ?? "login"),
              createdAt: String(e.created_at ?? ""),
              ip: e.ip as string | null | undefined,
              city: e.city as string | null | undefined,
              country: e.country as string | null | undefined,
              userAgent: e.user_agent as string | null | undefined,
            }))
            .sort(
              (a: ActivityEvent, b: ActivityEvent) =>
                new Date(b.createdAt ?? "").getTime() -
                new Date(a.createdAt ?? "").getTime()
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
          // Guard the parse: an unparseable timestamp must not throw and blank
          // the whole feed.
          const parsed = new Date(event.createdAt ?? "");
          const timeStr = Number.isNaN(parsed.getTime())
            ? "recently"
            : parsed.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

          return (
            <motion.div
              key={`${event.event}-${event.createdAt}-${i}`}
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