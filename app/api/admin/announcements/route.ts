import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireRole, audit } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";

/** Announcements: admin+ publish banners/posts/changelog; public read elsewhere.
 *  Admin writes/reads of inactive rows need the service client — RLS only
 *  exposes active rows to everyone else. */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "moderator", user.email);
    const db = await createServiceClient();
    const { data, error } = await db
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: "Could not load announcements." }, { status: 500 });
    return NextResponse.json({ announcements: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "moderator", user.email);
    const db = await createServiceClient();
    const body = await readJson(req);
    const kind = readString(body, "kind", 20) || "post";
    const title = readString(body, "title", 200);
    const text = readString(body, "body", 20000);
    const version = readString(body, "version", 40) || null;
    if (!title || !text) throw new BadRequestError("Title and body are required.");
    if (!["banner", "post", "changelog", "maintenance"].includes(kind)) {
      throw new BadRequestError("Invalid announcement type.");
    }
    const { data, error } = await db
      .from("announcements")
      .insert({ author_id: user.id, kind, title, body: text, version })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Publish failed." }, { status: 500 });
    await audit(db, user.id, "announcement_create", null, { kind, title });
    return NextResponse.json({ announcement: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin", user.email);
    const db = await createServiceClient();
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    if (!id) throw new BadRequestError("Missing id.");
    const updates: Record<string, unknown> = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (Object.keys(updates).length === 0) throw new BadRequestError("Nothing to update.");
    const { error } = await db.from("announcements").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
    await audit(db, user.id, "announcement_update", null, { id, ...updates });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin", user.email);
    const db = await createServiceClient();
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    if (!id) throw new BadRequestError("Missing id.");
    await db.from("announcements").delete().eq("id", id);
    await audit(db, user.id, "announcement_delete", null, { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
