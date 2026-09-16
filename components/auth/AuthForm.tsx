"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const isSignup = mode === "signup";

  // Surface OAuth/callback errors passed back via query string.
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(err);
  }, [searchParams]);

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
        `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (oauthError) {
        setError(
          /provider is not enabled|not enabled/i.test(oauthError.message)
            ? "Google sign-in isn't enabled for this project yet. Use email and password, or enable the Google provider in Supabase."
            : oauthError.message
        );
        setOauthLoading(false);
      }
      // On success the browser is redirected to Google; no further action here.
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setOauthLoading(false);
    }
  }

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
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
          },
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
        const { error: signInError } = await supabase.auth.signInWithPassword({
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

  const busy = loading || oauthLoading;
  const inputCls =
    "w-full rounded-lg border border-kore-border bg-kore-bg py-2.5 pl-10 pr-3 text-sm text-kore-strong placeholder:text-kore-muted/60 transition focus:border-kore-accent disabled:opacity-60";

  return (
    <div className="kore-glass w-full max-w-md rounded-2xl p-6 shadow-panel sm:p-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-kore-strong">
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
          className="mb-4 flex items-start gap-2 rounded-lg border border-kore-danger/40 bg-kore-danger/10 px-3 py-2.5 text-sm text-kore-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-kore-success/40 bg-kore-success/10 px-3 py-2.5 text-sm text-kore-success"
        >
          {info}
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-kore-border bg-kore-panel px-4 py-2.5 text-sm font-medium text-kore-strong transition hover:border-kore-accent/50 hover:shadow-panel disabled:cursor-not-allowed disabled:opacity-60"
      >
        {oauthLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </button>

      <div className="mb-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-kore-border" />
        <span className="text-xs font-medium uppercase tracking-wider text-kore-muted">
          or
        </span>
        <span className="h-px flex-1 bg-kore-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kore-strong">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kore-muted" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              placeholder="you@example.com"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-kore-strong">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kore-muted" aria-hidden />
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              placeholder="••••••••"
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-kore-muted transition hover:text-kore-strong"
              aria-label={showPw ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
        {isSignup && (
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-kore-strong">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kore-muted" aria-hidden />
              <input
                id="confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-kore-accent px-4 py-2.5 font-semibold text-kore-onAccent transition hover:bg-kore-accentDim disabled:cursor-not-allowed disabled:opacity-60"
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
            <Link href="/login" className="font-medium text-kore-accent hover:underline">
              Login
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-kore-accent hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
