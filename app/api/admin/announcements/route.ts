import { NextResponse } from "next/server";
import { readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireStaff, adminError } from "@/lib/admin-guard";

/** Announcements: moderator+ publish banners/posts/changelog; public read elsewhere.
 *  Writes run with the service client from the guard — RLS only exposes active
 *  rows to everyone else. */
export async function GET() {
  try {
    const actor = await requireStaff("moderator");
    const { data, error } = await actor.db
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: "Could not load announcements." }, { status: 500 });
    return NextResponse.json({ announcements: data ?? [] });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireStaff("moderator");
    const db = actor.db;
    const body = await readJson(req);
    const kind = readString(body, "kind", 20) || "post";
    const title = readString(body, "title", 200);
    const text = readString(body, "body", 20000);
    const version = readString(body, "version", 40) || null;
    if (!title || !text) throw new BadRequestError("Title and body are required.");
    if (!["banner", "post", "changelog", "maintenance"].includes(kind)) {
      throw new BadRequestError("Invalid announcement type.");
    }
    // author_id is a profile FK and stays null for username/password staff;
    // author_label records who actually published it.
    const { data, error } = await db
      .from("announcements")
      .insert({
        author_id: actor.userId,
        author_label: actor.username,
        kind,
        title,
        body: text,
        version,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Publish failed." }, { status: 500 });
    try {
      await db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "announcement_create",
        detail: { kind, title },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ announcement: data });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireStaff("admin");
    const db = actor.db;
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    if (!id) throw new BadRequestError("Missing id.");
    const updates: Record<string, unknown> = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (Object.keys(updates).length === 0) throw new BadRequestError("Nothing to update.");
    const { error } = await db.from("announcements").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
    try {
      await db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "announcement_update",
        detail: { id, ...updates },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requireStaff("admin");
    const db = actor.db;
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    if (!id) throw new BadRequestError("Missing id.");
    await db.from("announcements").delete().eq("id", id);
    try {
      await db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "announcement_delete",
        detail: { id },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
