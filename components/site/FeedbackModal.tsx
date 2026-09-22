"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareHeart, ExternalLink, Loader2, X, PartyPopper } from "lucide-react";
import { EASE, press } from "@/lib/motion";

/**
 * "Need a hand?" — the floating site-wide feedback widget.
 * Real submissions go to the admin inbox; the first one each day grants +2
 * credits (the API decides, the copy here stays honest).
 */
export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, page: window.location.pathname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send. Try again.");
      } else {
        setResult(
          data.creditsGranted > 0
            ? "Sent — +2 credits added to today's balance."
            : "Sent. Thanks for the help."
        );
        setMessage("");
      }
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <motion.button
        whileHover={{ translateY: -2 }}
        whileTap={press}
        transition={{ duration: 0.15, ease: EASE }}
        onClick={() => {
          setOpen(true);
          setResult(null);
          setError(null);
        }}
        aria-label="Need a hand? Send feedback"
        className="glass glass-sheen fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-kore-text"
      >
        <MessageSquareHeart className="h-4 w-4 text-kore-accent" aria-hidden />
        <span className="hidden sm:inline">Need a hand?</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => !sending && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              className="glass glass-sheen w-full max-w-md rounded-2xl p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Need a hand?</h2>
                  <p className="mt-0.5 text-xs text-kore-muted">
                    Found a bug, missing feature, or something confusing? Tell us.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-kore-muted transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <a
                href="https://discord.gg"
                target="_blank"
                rel="noreferrer"
                className="glass glass-interactive mt-4 flex items-center justify-between rounded-xl px-4 py-3 text-sm text-kore-text"
              >
                <span>Ask on Discord — fast answers</span>
                <ExternalLink className="h-4 w-4 text-kore-muted" aria-hidden />
              </a>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="What happened, or what should ZeroKore do better?"
                className="mt-3 w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3.5 py-3 text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
              />

              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              {result && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                  <PartyPopper className="h-3.5 w-3.5" aria-hidden /> {result}
                </p>
              )}

              <motion.button
                whileTap={press}
                onClick={send}
                disabled={sending || message.trim().length < 5}
                className="mt-3 w-full rounded-full bg-kore-accent px-4 py-2.5 text-sm font-semibold text-black transition disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  "Send feedback"
                )}
              </motion.button>
              <p className="mt-2 text-center text-[11px] text-kore-muted">
                First message each day earns +2 credits.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
