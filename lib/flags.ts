import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Site flags (maintenance mode etc.), stored in `site_flags`.
 * Read server-side; the maintenance flag gates every page layout and API.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

export interface MaintenanceFlag {
  enabled: boolean;
  message: string;
}

const DEFAULT_MAINTENANCE: MaintenanceFlag = { enabled: false, message: "" };

/**
 * The build's own version string. Bump this in the same commit as a release so
 * the changelog and the avatar menu agree with what is actually deployed.
 */
export const CURRENT_VERSION = "1.1.0";

export interface SiteFlags {
  maintenance: boolean;
  maintenanceMessage: string;
  version: string;
}

/**
 * Convenience reader used by public pages (changelog, landing) that have no
 * session. Falls back to safe defaults when the platform migration is still
 * pending, so a missing table degrades to "everything normal" instead of an
 * error page.
 */
export async function getSiteFlags(): Promise<SiteFlags> {
  const fallback: SiteFlags = {
    maintenance: false,
    maintenanceMessage: "",
    version: CURRENT_VERSION,
  };
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const db = (await createServiceClient()) as unknown as Db;
    const [{ data: maint }, { data: ver }] = await Promise.all([
      db.from("site_flags").select("value").eq("key", "maintenance").maybeSingle(),
      db.from("site_flags").select("value").eq("key", "version").maybeSingle(),
    ]);
    const published =
      ver?.value && typeof ver.value.version === "string"
        ? (ver.value.version as string)
        : CURRENT_VERSION;
    return {
      maintenance: maint?.value?.enabled === true,
      maintenanceMessage:
        typeof maint?.value?.message === "string" ? maint.value.message : "",
      version: published,
    };
  } catch {
    return fallback;
  }
}

export async function getMaintenanceFlag(db: Db): Promise<MaintenanceFlag> {
  try {
    const { data } = await db
      .from("site_flags")
      .select("value")
      .eq("key", "maintenance")
      .maybeSingle();
    if (!data?.value) return DEFAULT_MAINTENANCE;
    return {
      enabled: data.value.enabled === true,
      message: typeof data.value.message === "string" ? data.value.message : "",
    };
  } catch {
    // A missing table must never take the site down.
    return DEFAULT_MAINTENANCE;
  }
}

export async function setMaintenanceFlag(
  db: Db,
  updatedBy: string,
  flag: MaintenanceFlag
): Promise<void> {
  await db.from("site_flags").upsert(
    { key: "maintenance", value: flag, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}
