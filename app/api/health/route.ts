import { NextRequest, NextResponse } from "next/server";
import { providerCatalog } from "@/lib/ai/cascade-router";
import { isEncryptionConfigured } from "@/lib/crypto";
import { platformReady } from "@/lib/platform";
import { ownerEmails, adminEmails } from "@/lib/rbac";
import { isAdminConfigured, listAdminAccounts } from "@/lib/admin-auth";

/**
 * Truthful health/config snapshot. Public (read-only, no secrets):
 * tells the UI which of the four models are configured, whether the
 * GitHub OAuth integration is set up, and whether project-secret
 * encryption has a key — never returns key values.
 *
 * Staff counts are reported as counts only: the panel's entry point is
 * unlisted, and publishing staff addresses here would defeat that.
 */
/**
 * The origin GitHub will redirect back to.
 *
 * Behind a proxy (Vercel) `req.nextUrl.origin` can be the internal host, so
 * prefer the public URL and fall back to the request origin.
 */
function publicOrigin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    req.nextUrl.origin
  );
}

/**
 * Whether `github_connections` is actually present.
 *
 * Read with the service role because the table deliberately has no client
 * policies — a browser session must never be able to read a token. A failure
 * here is the signal that migration 007 has not been applied.
 */
async function githubStorageState(): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "no service role key";
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const service = await createServiceClient();
    // A count is enough: any successful query proves the table exists, and no
    // token value is read or exposed.
    const { error } = await service
      .from("github_connections")
      .select("user_id", { count: "exact", head: true });
    if (error) return `table unavailable (${error.message})`;
    return "ready";
  } catch (err) {
    return `unreachable (${err instanceof Error ? err.message : "unknown"})`;
  }
}

/** Whether the chat tables exist, so history can actually be written. */
async function chatStorageState(): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "no service role key";
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const service = await createServiceClient();
    // A count proves both tables exist; no message content is read.
    const { error } = await service
      .from("messages")
      .select("id", { count: "exact", head: true });
    if (error) return `table unavailable (${error.message})`;
    return "ready";
  } catch (err) {
    return `unreachable (${err instanceof Error ? err.message : "unknown"})`;
  }
}

export async function GET(req: NextRequest) {
  const models = await providerCatalog();
  const github =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  const owners = ownerEmails().length;
  const admins = adminEmails().length;

  // Staff accounts in Supabase are the real access path for the panel (the
  // owner plus every account they create), so count them too.
  let accountCount = 0;
  let accountOwner = false;
  try {
    const accounts = await listAdminAccounts();
    accountCount = accounts.length;
    accountOwner = accounts.some((a) => a.isOwner);
  } catch {
    // table missing until 004 is applied
  }
  const staffConfigured =
    accountCount > 0 || owners + admins > 0 || (await isAdminConfigured());

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
    // OpenRouter fronts many models behind one key, so it is summarised here
    // rather than inflating the `models` list with every entry.
    openrouter: process.env.OPENROUTER_API_KEY
      ? `configured · ${models.filter((m) => m.id.startsWith("OpenRouter:")).length} models`
      : "not configured",
    search: process.env.TAVILY_API_KEY ? "configured" : "not configured",
    github: github ? "configured" : "not configured",
    // The exact callback this deployment sends to GitHub. Publishing it is
    // harmless — it is already visible in the authorize URL — and it is the
    // single most useful thing to check when the OAuth screen misbehaves,
    // because GitHub rejects any redirect_uri that is not registered exactly.
    githubCallback: github
      ? `${publicOrigin(req)}/api/github/oauth`
      : null,
    // Whether the token table actually exists. This was the real cause of
    // "import does nothing": github_connections lived only in the outdated
    // schema.sql, so every write failed and every read looked like
    // "not connected". Reporting it turns a silent failure into a visible one.
    githubStorage: await githubStorageState(),
    // Chat history lives in `messages`, which like github_connections was
    // defined only in the outdated schema.sql. Without migration 008 the agent
    // replies normally and silently discards every message, so this is worth
    // reporting rather than leaving as another invisible failure.
    chatStorage: await chatStorageState(),
    // Without a valid ENCRYPTION_KEY the Secrets environment refuses to store
    // values (AES-256-GCM) rather than writing them in plaintext.
    encryption: isEncryptionConfigured() ? "configured" : "not configured",
    // Required to persist GitHub tokens and read secret summaries, both of which
    // live in tables with RLS and no client policies.
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "configured"
      : "not configured",
    // "not configured" means no owner account exists yet, so /kore/admin
    // cannot be opened by anyone. Counts only — never addresses or usernames.
    staff: !staffConfigured
      ? "not configured"
      : `${accountCount || owners + admins} staff account(s)${accountOwner || owners ? ", owner present" : ""}`,
    // IP + approximate location are recorded on auth events and shown to staff.
    requestLogging: "ip, approximate location, device — disclosed in /privacy",
    timestamp: new Date().toISOString(),
  });
}
