import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";

/** Login/security history for the current user (own rows only). */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("login_events")
      .select("event, ip, country, city, user_agent, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: "Could not load history." }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}
