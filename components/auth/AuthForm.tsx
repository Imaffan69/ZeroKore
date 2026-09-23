"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, Loader2, AlertCircle, ShieldCheck, Github, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeUsername, usernameError } from "@/lib/username";
import { cn } from "@/lib/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the Supabase client can be constructed at all. */
function isConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON);
}

/** Translate raw auth failures into concise, actionable copy. */
function humanizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return "Could not reach the authentication service. If this is a fresh deploy, verify the Supabase project is active and the URL/key env vars are set.";
  }
  if (m.includes("email not confirmed")) {
    return "Please verify your email before logging in. Check your inbox for the confirmation link.";
  }
  if (m.includes("invalid login")) {
    return "Incorrect email or password.";
  }
  if (m.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return message;
}

type Mode = "login" | "signup";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** The public shape of a ZeroKore URL, shown live while typing a username. */
export function publicUrlPreview(username: string): string {
  return `zerokore.vercel.app/${username || "your-name"}/project-name`;
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);

  const isSignup = mode === "signup";
  // Live username feedback, using the exact rules the API and database apply.
  const usernameProblem = username ? usernameError(username) : null;

  // Detect server auth configuration on mount so the form can explain
  // itself instead of failing with a raw fetch error on submit.
  useEffect(() => {
    setConfigured(isConfigured());
  }, []);

  // Surface OAuth callback failures (?error=...) as an inline, human message.
  useEffect(() => {
    const oauthErr = searchParams.get("error");
    if (oauthErr) setError(oauthErr);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const identifier = email.trim().toLowerCase();
    const isUsernameLogin = !isSignup && identifier !== "" && !identifier.includes("@");

    if (!isUsernameLogin && !validateEmail(identifier)) {
      setError("Please enter a valid email address, or your username.");
      return;
    }
    if (isSignup && usernameProblem) {
      setError(usernameProblem);
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

    // Blocked up-front when the deployment lacks auth configuration.
    if (!configured) {
      setError(
        "Authentication is not configured on this deployment yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the server environment, then reload."
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: identifier,
          password,
          // The chosen username is stored on the account; a database trigger
          // claims it (or derives one) when the profile row is created.
          options: { data: { username: normalizeUsername(username) } },
        });
        if (signUpError) {
          if (/already|exists|duplicate/i.test(signUpError.message)) {
            setError("An account with this email already exists. Try logging in.");
          } else {
            setError(humanizeAuthError(signUpError.message));
          }
          return;
        }
        setInfo(
          "Account created. If email confirmation is enabled, check your inbox — otherwise you can log in now."
        );
        // Auto-continue when email confirmation is disabled.
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          router.push(next);
          router.refresh();
        }
      } else if (isUsernameLogin) {
        // Usernames are resolved server-side; the password is still verified by
        // Supabase Auth, never by our own code.
        const res = await fetch("/api/auth/username-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Could not sign in. Try again.");
          return;
        }
        router.push(next);
        router.refresh();
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: identifier,
            password,
          });
        if (signInError) {
          if (/invalid login|invalid.*credential/i.test(signInError.message)) {
            setError("Incorrect email or password.");
          } else if (/confirm|verif/i.test(signInError.message)) {
            setError("Please verify your email before logging in.");
          } else {
            setError(humanizeAuthError(signInError.message));
          }
          return;
        }
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? humanizeAuthError(err.message)
          : "Network error. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setInfo(null);
    if (!configured) {
      setError(
        "Authentication is not configured on this deployment yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the server environment, then reload."
      );
      return;
    }
    setOauthBusy(provider);
    try {
      const { error: oauthError } = await supabaseSignIn(provider);
      if (oauthError) {
        setError(
          provider === "google"
            ? "Google sign-in is not enabled yet. Enable the Google provider in Supabase Auth settings."
            : "GitHub sign-in is not enabled yet. Enable the GitHub provider in Supabase Auth settings."
        );
      }
      // On success the browser redirects to the provider, then back here.
    } catch {
      setError("Could not start the sign-in flow. Check your connection.");
    } finally {
      setOauthBusy(null);
    }
  }

  async function supabaseSignIn(provider: "google" | "github") {
    const supabase = createClient();
    // Always return through our callback so the PKCE code is exchanged
    // server-side before landing on the destination page.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-sheen w-full max-w-md rounded-3xl p-6 sm:p-8"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <motion.span
          className="glass-accent flex h-9 w-9 items-center justify-center rounded-2xl"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <Terminal className="h-5 w-5 text-kore-accent" aria-hidden />
        </motion.span>
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

      {(!configured || error) && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3 py-2.5 text-sm text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {!configured
              ? "Authentication is not configured on this deployment. The server needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (plus the schema from supabase/schema.sql) before accounts can be created."
              : error}
          </span>
        </div>
      )}
      {configured && info && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-kore-accent/40 bg-kore-accent/10 px-3 py-2.5 text-sm text-white"
        >
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {isSignup && (
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="your-name"
              aria-invalid={!!usernameProblem}
              aria-describedby="username-help"
              className="glass-subtle w-full rounded-2xl px-4 py-2.5 font-mono text-sm text-kore-text placeholder:text-kore-muted/60 focus:border-kore-accent disabled:opacity-60"
            />
            <p
              id="username-help"
              className={cn(
                "mt-1.5 font-mono text-[11px]",
                usernameProblem ? "text-kore-warn" : "text-kore-muted"
              )}
            >
              {usernameProblem ??
                (username
                  ? publicUrlPreview(normalizeUsername(username))
                  : "Your projects live at zerokore.vercel.app/<username>/<project>")}
            </p>
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            {isSignup ? "Email" : "Username or email"}
          </label>
          <input
            id="email"
            type="text"
            autoComplete={isSignup ? "email" : "username"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder={isSignup ? "you@example.com" : "your-name or you@example.com"}
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
          className="glass-interactive flex w-full items-center justify-center gap-2 rounded-full bg-kore-accent px-4 py-2.5 font-semibold text-black shadow-glow transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* OAuth providers */}
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-kore-border" />
        <span className="text-xs text-kore-muted">or continue with</span>
        <span className="h-px flex-1 bg-kore-border" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <motion.button
          type="button"
          whileHover={{ translateY: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOAuth("google")}
          disabled={oauthBusy !== null || loading}
          className="glass glass-interactive flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-kore-text transition hover:text-white disabled:opacity-60"
        >
          {oauthBusy === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.62.75 3.84 3.27 2.04 6.86l3.66 2.84C6.6 7.02 9.05 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.25 12.27c0-.93-.08-1.6-.26-2.31H12v4.19h6.44c-.13 1.08-.83 2.7-2.39 3.79l3.57 2.77c2.14-1.97 3.63-4.88 3.63-8.44z"/>
              <path fill="#FBBC05" d="M5.71 14.3A6.9 6.9 0 0 1 5.33 12c0-.8.14-1.57.36-2.3L2.03 6.86A11.24 11.24 0 0 0 .75 12c0 1.81.44 3.52 1.28 5.14l3.68-2.84z"/>
              <path fill="#34A853" d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.57-2.77c-.95.66-2.23 1.12-3.89 1.12-2.95 0-5.4-1.98-6.3-4.66l-3.66 2.84c1.8 3.59 5.58 6.19 9.96 6.19z"/>
            </svg>
          )}
          Google
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ translateY: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOAuth("github")}
          disabled={oauthBusy !== null || loading}
          className="glass glass-interactive flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-kore-text transition hover:text-white disabled:opacity-60"
        >
          {oauthBusy === "github" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Github className="h-4 w-4" aria-hidden />
          )}
          GitHub
        </motion.button>
      </div>

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

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-kore-muted/70">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        <Mail className="hidden" aria-hidden />
        Passwords are hashed by Supabase Auth. ZeroKore never sees them.
      </p>
    </motion.div>
  );
}