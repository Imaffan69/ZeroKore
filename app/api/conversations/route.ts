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

/** List the caller's conversations (newest first). */
export async function GET() {
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  const { data, error } = await ctx.supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json(
      { error: "Could not load conversations." },
      { status: 500 }
    );
  }
  return NextResponse.json({ conversations: data ?? [] });
}

/** Create a new conversation for the caller. */
export async function POST(req: NextRequest) {
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  let title = "New Conversation";
  try {
    const body = await req.json();
    if (typeof body?.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 120);
    }
  } catch {
    // Default title.
  }
  const { data, error } = await ctx.supabase
    .from("conversations")
    .insert({ user_id: ctx.user.id, title })
    .select("id, title, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: "Could not create conversation." },
      { status: 500 }
    );
  }
  return NextResponse.json({ conversation: data });
}