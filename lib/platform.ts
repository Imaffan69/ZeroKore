import { createServiceClient } from "@/lib/supabase/server";

/**
 * Platform migration probe.
 *
 * The credits / staff / feedback features live in `supabase/migrations/`. If
 * that migration has not been applied yet, every dependent table is missing —
 * and a hard dependency would turn "one file not pasted" into "the whole site
 * 500s". Instead we probe once, cache the answer briefly, and let callers fall
 * back to a permissive, clearly-labelled degraded mode.
 *
 * `platformReady()` is therefore a *capability check*, not a health verdict:
 * false means "run the migration to switch these features on".
 */

let cached: { ready: boolean; at: number } | null = null;
const TTL_MS = 60_000;

/** PostgREST/SQL codes that mean "this relation is not in the schema yet". */
const MISSING_CODES = new Set(["42P01", "PGRST205", "404"]);

export async function platformReady(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.ready;

  let ready = false;
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from("site_flags").select("key").limit(1);
    ready = !error || !MISSING_CODES.has(error.code ?? "");
  } catch {
    ready = false;
  }

  cached = { ready, at: Date.now() };
  return ready;
}

/** Force the next probe to re-read the schema (used after an admin write). */
export function resetPlatformCache(): void {
  cached = null;
}
