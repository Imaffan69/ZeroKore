import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth shell for /login and /signup.
 *
 * A signed-in visitor has nothing to do here, so the layout sends them straight
 * to the workspace instead of showing a login form that would immediately be
 * redundant. The check is contained to this layout (not middleware) and any
 * failure degrades to rendering the form, which still lets a locked-out user
 * back in when Supabase is unreachable.
 */
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
    <main className="relative flex min-h-screen flex-col bg-kore-bg text-kore-text">
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-sm text-kore-muted transition hover:text-kore-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Suspense
          fallback={
            <div className="font-mono text-sm text-kore-muted">
              Loading…
            </div>
          }
        >
          {children}
        </Suspense>
      </div>
    </main>
  );
}