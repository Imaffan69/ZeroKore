import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUsername } from "@/lib/profiles";
import { normalizeUsername } from "@/lib/username";

/**
 * Sign in with a username *or* an email.
 *
 * Supabase Auth only knows email addresses, so a username is resolved to its
 * account first and the password is then verified by Auth itself — this route
 * never checks a password and never receives a hash. The answer is deliberately
 * identical for "no such username" and "wrong password" so usernames cannot be
 * enumerated by trying them.
 */
export async function POST(req: Request) {
  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON." },
      { status: 400 }
    );
  }

  const identifier =
    typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 }
    );
  }

  // An "@" means the user typed an email; anything else is a username.
  let email = identifier.toLowerCase();
  if (!identifier.includes("@")) {
    const found = await resolveUsername(normalizeUsername(identifier));
    if (!found) {
      return NextResponse.json(
        { error: "Incorrect username or password." },
        { status: 401 }
      );
    }
    try {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const service = await createServiceClient();
      const { data } = await service
        .from("profiles")
        .select("email")
        .eq("id", found.id)
        .maybeSingle();
      const resolved = (data?.email as string | null) ?? null;
      if (!resolved) {
        return NextResponse.json(
          { error: "Incorrect username or password." },
          { status: 401 }
        );
      }
      email = resolved.toLowerCase();
    } catch {
      return NextResponse.json(
        { error: "Could not reach the account service. Try again." },
        { status: 503 }
      );
    }
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured. Contact the administrator." },
      { status: 500 }
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const unconfirmed = /confirm|verif/i.test(error.message);
    return NextResponse.json(
      {
        error: unconfirmed
          ? "Verify your email before logging in. Check your inbox for the confirmation link."
          : "Incorrect username or password.",
      },
      { status: unconfirmed ? 403 : 401 }
    );
  }

  return NextResponse.json({ ok: true, email });
}
