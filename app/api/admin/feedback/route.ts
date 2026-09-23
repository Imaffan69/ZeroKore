import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireRole, audit } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";

/** Feedback inbox: moderator+ read (support and up see it), moderator+ can change status. */
export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "moderator", user.email);
    const db = await createServiceClient();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    let query = db
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status && ["open", "read", "resolved"].includes(status)) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load feedback." }, { status: 500 });

    // Enrich with author identity (feedback has no FK to profiles, so the
    // PostgREST embed cannot be used — fetch the rows explicitly).
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id, username, email").in("id", ids)
      : { data: [] as { id: string; username: string | null; email: string | null }[] };
    const byId = new Map(
      (profiles ?? []).map((p: { id: string; username: string | null; email: string | null }) => [p.id, p])
    );
    const enriched = rows.map((r: { user_id: string }) => ({
      ...r,
      profiles: byId.get(r.user_id) ?? null,
    }));
    return NextResponse.json({ feedback: enriched });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "moderator", user.email);
    const db = await createServiceClient();
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    const status = readString(body, "status", 20);
    if (!id || !["open", "read", "resolved"].includes(status)) {
      throw new BadRequestError("Invalid feedback update.");
    }
    const { error } = await db.from("feedback").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
    await audit(db, user.id, "feedback_status", null, { id, status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
