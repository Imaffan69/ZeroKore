import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, FileCode2, Terminal, Layers, Github } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProductDemo from "@/components/landing/ProductDemo";

/**
 * Auth shell for /login and /signup.
 *
 * A signed-in visitor has nothing to do here, so the layout sends them straight
 * to the workspace instead of showing a login form that would immediately be
 * redundant. The check is contained to this layout (not middleware) and any
 * failure degrades to rendering the form, which still lets a locked-out user
 * back in when Supabase is unreachable.
 *
 * Layout: the form sits in a right-hand column beside a live view of the product.
 * A single card floating in the middle of a black page read as an unfinished
 * screen — the visitor had no idea what they were signing in to. Showing the
 * workspace itself answers that before they type anything.
 */

const PROOF = [
  { icon: FileCode2, label: "Real file edits", hint: "any text format" },
  { icon: Terminal, label: "Live terminal", hint: "real commands" },
  { icon: Layers, label: "Environments", hint: "preview + secrets" },
  { icon: Github, label: "Git in and out", hint: "import and push" },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await cookies();
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect("/dashboard");

  return (
    <main className="relative min-h-dvh bg-kore-bg text-kore-text">
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1500px] grid-cols-1 items-center gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_minmax(380px,460px)] lg:gap-14 lg:py-10">
        {/* The product, so the form has context. */}
        <section className="order-2 lg:order-1">
          <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">
            AUTONOMOUS DEVELOPMENT WORKSPACE
          </p>
          <h1 className="mt-4 text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Your whole build,
            <br />
            <span className="bg-gradient-to-r from-[#b5cfa0] via-[#e8f3df] to-white bg-clip-text text-transparent">
              in one workspace.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-kore-body sm:text-base">
            Start from nothing, import any repository you own, then edit real
            files, run commands and push it back to Git — with an AI agent doing
            the heavy lifting beside you.
          </p>

          <ul className="mt-7 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
            {PROOF.map(({ icon: Icon, label, hint }) => (
              <li key={label} className="glass-subtle rounded-xl px-3 py-2.5">
                <Icon className="h-3.5 w-3.5 text-kore-accent" aria-hidden />
                <p className="mt-1.5 text-[11px] font-medium leading-tight text-white">
                  {label}
                </p>
                <p className="text-[10px] leading-tight text-kore-muted">{hint}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden max-w-2xl lg:block">
            <ProductDemo />
          </div>
        </section>

        {/* The form. */}
        <section className="order-1 lg:order-2">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-1.5 font-mono text-sm text-kore-muted transition hover:text-kore-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </Link>
          <Suspense
            fallback={
              <div className="font-mono text-sm text-kore-muted">Loading…</div>
            }
          >
            {children}
          </Suspense>
        </section>
      </div>
    </main>
  );
}