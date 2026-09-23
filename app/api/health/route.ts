import { NextResponse } from "next/server";
import { providerCatalog } from "@/lib/ai/cascade-router";
import { isEncryptionConfigured } from "@/lib/crypto";
import { platformReady } from "@/lib/platform";
import { ownerEmails, adminEmails } from "@/lib/rbac";

/**
 * Truthful health/config snapshot. Public (read-only, no secrets):
 * tells the UI which of the four models are configured, whether the
 * GitHub OAuth integration is set up, and whether project-secret
 * encryption has a key — never returns key values.
 *
 * Staff counts are reported as counts only: the panel's entry point is
 * unlisted, and publishing staff addresses here would defeat that.
 */
export async function GET() {
  const models = providerCatalog();
  const github =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  const owners = ownerEmails().length;
  const admins = adminEmails().length;

  return NextResponse.json({
    application: "healthy",
    // "migration pending" means supabase/migrations/*.sql has not been applied:
    // credits are not charged yet and staff tables are absent.
    platform: (await platformReady()) ? "ready" : "migration pending",
    database: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "configured"
      : "not configured",
    authentication: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "configured"
      : "not configured",
    models,
    search: process.env.TAVILY_API_KEY ? "configured" : "not configured",
    github: github ? "configured" : "not configured",
    // Without a valid ENCRYPTION_KEY the Secrets environment refuses to store
    // values (AES-256-GCM) rather than writing them in plaintext.
    encryption: isEncryptionConfigured() ? "configured" : "not configured",
    // Required to persist GitHub tokens and read secret summaries, both of which
    // live in tables with RLS and no client policies.
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "configured"
      : "not configured",
    // 0 means no OWNER_EMAIL is set, so no account can reach the control panel.
    staff: owners + admins === 0 ? "not configured" : `${owners} owner, ${admins} admin`,
    // IP + approximate location are recorded on auth events and shown to staff.
    requestLogging: "ip, approximate location, device — disclosed in /privacy",
    timestamp: new Date().toISOString(),
  });
}
