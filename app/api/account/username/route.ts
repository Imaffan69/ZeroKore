import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, errorResponse, readJson } from "@/lib/api-auth";
import { normalizeUsername, usernameError, USERNAME_MAX } from "@/lib/username";
import { uniqueUsername } from "@/lib/profiles";

/**
 * GET → the caller's identity for settings (username + email).
 * PUT { username } → claim/change the username. Validated, moderated,
 * collision-checked; errors are honest (taken / reserved / blocked).
 */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    return NextResponse.json({
      username: (data?.username as string | null) ?? null,
      email: user.email ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);
    const wanted = normalizeUsername(String(body.username ?? ""));
    if (!wanted) {
      return NextResponse.json(
        { error: `Pick a username, 3–${USERNAME_MAX} characters, letters, numbers and dashes.` },
        { status: 400 }
      );
    }
    const problem = usernameError(wanted);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const unique = await uniqueUsername(supabase, wanted);
    if (unique !== wanted) {
      return NextResponse.json(
        {
          error:
            unique.toLowerCase().startsWith(wanted)
              ? "That username is taken — try adding a number or a dash."
              : "That username is reserved or not allowed — pick something else.",
        },
        { status: 409 }
      );
    }

    const client = await createClient();
    const { error } = await client
      .from("profiles")
      .update({ username: wanted })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json(
        { error: "Could not save that username. It may have just been taken." },
        { status: 409 }
      );
    }
    return NextResponse.json({ username: wanted });
  } catch (err) {
    return errorResponse(err);
  }
}
