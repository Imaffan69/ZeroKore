import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsageState } from "@/lib/usage";

/** Read-only usage snapshot for the sidebar gauge (no increment). */
export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured." },
      { status: 500 }
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  try {
    const usage = await getUsageState(supabase, user.id);
    return NextResponse.json({ usage });
  } catch {
    return NextResponse.json(
      { error: "Could not load usage." },
      { status: 500 }
    );
  }
}