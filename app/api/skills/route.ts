import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSkills } from "@/lib/skills";

/** Reads the filesystem at request time, so it must never be prerendered. */
export const dynamic = "force-dynamic";

/** List the skills available to the signed-in user. */
export async function GET() {
  let authenticated = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = !!user;
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const skills = await listSkills();
  return NextResponse.json({ skills });
}
