import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireRole, audit } from "@/lib/rbac";

/** Feedback inbox: admin+ read, moderator+ can change status. */
export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin");
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    let query = supabase
      .from("feedback")
      .select("*, profiles:user_id (email, username)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status && ["open", "read", "resolved"].includes(status)) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load feedback." }, { status: 500 });
    return NextResponse.json({ feedback: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "moderator");
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    const status = readString(body, "status", 20);
    if (!id || !["open", "read", "resolved"].includes(status)) {
      throw new BadRequestError("Invalid feedback update.");
    }
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
    await audit(supabase, user.id, "feedback_status", null, { id, status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
