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

async function owns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  id: string
) {
  const { data } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Load one conversation + its messages (owner only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  const conv = await owns(ctx.supabase, ctx.user.id, id);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  const { data: messages, error } = await ctx.supabase
    .from("messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    return NextResponse.json(
      { error: "Could not load messages." },
      { status: 500 }
    );
  }
  return NextResponse.json({ conversation: conv, messages: messages ?? [] });
}

/** Rename a conversation (owner only). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  const conv = await owns(ctx.supabase, ctx.user.id, id);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  let title = "";
  try {
    const body = await req.json();
    if (typeof body?.title === "string") title = body.title.trim().slice(0, 120);
  } catch {
    // fall through to validation
  }
  if (!title) {
    return NextResponse.json(
      { error: "Title must not be empty." },
      { status: 400 }
    );
  }
  const { error } = await ctx.supabase
    .from("conversations")
    .update({ title })
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) {
    return NextResponse.json(
      { error: "Could not rename conversation." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, title });
}

/** Delete a conversation + its messages (owner only, cascade). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authed().catch(() => null);
  if (!ctx) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  const conv = await owns(ctx.supabase, ctx.user.id, id);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  const { error } = await ctx.supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);
  if (error) {
    return NextResponse.json(
      { error: "Could not delete conversation." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}