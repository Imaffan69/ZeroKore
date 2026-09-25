import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * TEMPORARY diagnostic sink for client-side render errors.
 *
 * A production error boundary receives a redacted message, and `console.error`
 * in a client component only reaches the browser — not the deployment logs. This
 * records the failure server-side so the cause can actually be identified and
 * fixed, instead of guessed at. Remove once the fault is resolved.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const record = {
      message: String(body?.message ?? "unknown").slice(0, 500),
      stack: String(body?.stack ?? "").slice(0, 2000),
      digest: body?.digest ? String(body.digest).slice(0, 40) : null,
      userAgent: String(req.headers.get("user-agent") ?? "").slice(0, 120),
      at: new Date().toISOString(),
    };
    const service = await createServiceClient();
    await service.from("site_flags").upsert(
      { key: "diag_dashboard_error", value: record },
      { onConflict: "key" }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
