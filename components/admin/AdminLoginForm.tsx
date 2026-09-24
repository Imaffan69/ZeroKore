"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { EASE } from "@/lib/motion";

export default function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Enter both username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/kore/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      window.location.href = "/kore/admin";
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-black">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="flex justify-center mb-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-kore-accent/10 border border-kore-accent/30">
            <ShieldCheck className="h-6 w-6 text-kore-accent" aria-hidden />
          </div>
        </div>

        <h1 className="text-center text-xl font-semibold text-white">
          Admin panel
        </h1>
        <p className="mt-2 text-center text-sm text-kore-muted">
          Sign in to manage users, view stats, post announcements, and control
          the site.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-kore-faint">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span>Hidden from the public. 404 for everyone else.</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="sr-only">
                Username
              </label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-kore-muted outline-none transition focus:border-kore-accent/60"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pr-10 text-sm text-white placeholder:text-kore-muted outline-none transition focus:border-kore-accent/60"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-kore-muted transition hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-kore-warn">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-kore-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-kore-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          <p className="mt-4 text-[11px] text-kore-faint leading-relaxed">
            Staff accounts are created by the site owner and authenticate with a username and
            password. The password is hashed on the server and never stored in plain text.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
