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
