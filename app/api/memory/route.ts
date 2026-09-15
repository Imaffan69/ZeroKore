import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

/** List the caller's saved memories (newest first). */
export async function GET() {
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  const { data, error } = await ctx.supabase
    .from("agent_memory")
    .select("id, content, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json(
      { error: "Could not load memory." },
      { status: 500 }
    );
  }
  return NextResponse.json({ memories: data ?? [] });
}

/** Delete one memory (owner only). Body: { id }. */
export async function DELETE(req: NextRequest) {
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  let id = "";
  try {
    const body = await req.json();
    if (typeof body?.id === "string") id = body.id;
  } catch {
    // fall through to validation
  }
  if (!id) {
    return NextResponse.json(
      { error: "Memory id is required." },
      { status: 400 }
    );
  }
  const { error } = await ctx.supabase
    .from("agent_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) {
    return NextResponse.json(
      { error: "Could not delete memory." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}