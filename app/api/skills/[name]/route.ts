import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSkill } from "@/lib/skills";

/** Reads the filesystem at request time, so it must never be prerendered. */
export const dynamic = "force-dynamic";

/** Read one skill including its markdown body. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

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

  const skill = await getSkill(name);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  return NextResponse.json({ skill });
}
