import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson } from "@/lib/api-auth";
import { requireRole, audit } from "@/lib/rbac";
import { getMaintenanceFlag, setMaintenanceFlag } from "@/lib/flags";

/** Site controls: maintenance mode (owner-only toggle). */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin");
    const flag = await getMaintenanceFlag(supabase);
    return NextResponse.json({ maintenance: flag });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "owner"); // shutdown is owner-only
    const body = await readJson(req);
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Missing enabled." }, { status: 400 });
    }
    const message =
      typeof body.message === "string" ? body.message.slice(0, 500) : "";
    await setMaintenanceFlag(supabase, user.id, { enabled: body.enabled, message });
    await audit(supabase, user.id, body.enabled ? "maintenance_enable" : "maintenance_disable");
    return NextResponse.json({ ok: true, maintenance: { enabled: body.enabled, message } });
  } catch (err) {
    return errorResponse(err);
  }
}
