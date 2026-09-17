"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Terminal, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (isSignup && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (signUpError) {
          if (/already|exists|duplicate/i.test(signUpError.message)) {
            setError("An account with this email already exists. Try logging in.");
          } else {
            setError(signUpError.message);
          }
          return;
        }
        setInfo(
          "Account created. If email confirmation is enabled, check your inbox — otherwise you can log in now."
        );
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
        if (signInError) {
          if (/invalid login|invalid.*credential/i.test(signInError.message)) {
            setError("Incorrect email or password.");
          } else if (/confirm|verif/i.test(signInError.message)) {
            setError("Please verify your email before logging in.");
          } else {
            setError(signInError.message);
          }
          return;
        }
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Network error. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass glass-sheen w-full max-w-md rounded-3xl p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="glass-accent flex h-9 w-9 items-center justify-center rounded-2xl">
          <Terminal className="h-5 w-5 text-kore-accent" aria-hidden />
        </span>
        <span className="font-mono text-lg font-bold tracking-widest">
          ZERO<span className="text-kore-accent">KORE</span>
        </span>
      </div>

      <h1 className="mb-1 text-xl font-bold text-white">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mb-6 text-sm text-kore-muted">
        {isSignup
          ? "Sign up to access the autonomous workspace."
          : "Log in to access the autonomous workspace."}
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3 py-2.5 text-sm text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-kore-accent/40 bg-kore-accent/10 px-3 py-2.5 text-sm text-emerald-300"
        >
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="you@example.com"
            className="glass-subtle w-full rounded-2xl px-4 py-2.5 text-sm text-kore-text placeholder:text-kore-muted/60 focus:border-kore-accent disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
            className="glass-subtle w-full rounded-2xl px-4 py-2.5 text-sm text-kore-text placeholder:text-kore-muted/60 focus:border-kore-accent disabled:opacity-60"
          />
        </div>
        {isSignup && (
          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-sm font-medium"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              className="glass-subtle w-full rounded-2xl px-4 py-2.5 text-sm text-kore-text placeholder:text-kore-muted/60 focus:border-kore-accent disabled:opacity-60"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="glass-interactive flex w-full items-center justify-center gap-2 rounded-full bg-kore-accent px-4 py-2.5 font-semibold text-black shadow-glow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {loading
            ? isSignup
              ? "Creating account…"
              : "Logging in…"
            : isSignup
              ? "Sign Up"
              : "Login"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-kore-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-kore-accent hover:underline">
              Login
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/signup" className="text-kore-accent hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}