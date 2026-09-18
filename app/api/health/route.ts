import { NextResponse } from "next/server";
import { providerCatalog } from "@/lib/ai/cascade-router";

/**
 * Truthful health/config snapshot. Public (read-only, no secrets):
 * tells the UI which of the four models are configured and whether the
 * GitHub OAuth integration is set up — never returns key values.
 */
export async function GET() {
  const models = providerCatalog();
  const github =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;

  return NextResponse.json({
    application: "healthy",
    database: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "configured"
      : "not configured",
    authentication: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "configured"
      : "not configured",
    models,
    search: process.env.TAVILY_API_KEY ? "configured" : "not configured",
    github: github ? "configured" : "not configured",
    timestamp: new Date().toISOString(),
  });
}
