import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/ai/cascade-router";

export async function GET() {
  const providers = configuredProviders();
  return NextResponse.json({
    application: "healthy",
    database: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "configured"
      : "not configured",
    authentication: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "configured"
      : "not configured",
    providers: providers.length > 0 ? providers : ["none configured"],
    search: process.env.TAVILY_API_KEY ? "configured" : "not configured",
    timestamp: new Date().toISOString(),
  });
}