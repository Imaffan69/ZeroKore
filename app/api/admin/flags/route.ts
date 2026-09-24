import { NextResponse } from "next/server";
import { readJson } from "@/lib/api-auth";
import { requireStaff, requireOwner, adminError } from "@/lib/admin-guard";
import { getMaintenanceFlag, setMaintenanceFlag } from "@/lib/flags";

/** Site controls: maintenance mode (owner-only toggle, admin+ can view). */
export async function GET() {
  try {
    const actor = await requireStaff("admin");
    const flag = await getMaintenanceFlag(actor.db);
    return NextResponse.json({ maintenance: flag });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  try {
    // Shutdown is owner-only, including the owner account signed in by password.
    const actor = await requireOwner();
    const db = actor.db;
    const body = await readJson(req);
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Missing enabled." }, { status: 400 });
    }
    const message =
      typeof body.message === "string" ? body.message.slice(0, 500) : "";
    await setMaintenanceFlag(db, actor.userId, { enabled: body.enabled, message });
    try {
      await db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: body.enabled ? "maintenance_enable" : "maintenance_disable",
        detail: { message },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true, maintenance: { enabled: body.enabled, message } });
  } catch (err) {
    return adminError(err);
  }
}
