import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import {
  USERNAME_MAX,
  normalizeUsername,
  usernameError,
  usernameFromEmail,
} from "@/lib/username";

/**
 * Profile helpers.
 *
 * A profile carries the public identity (`username`) that every project URL is
 * built from, so reads happen in two modes:
 *   - the caller's own profile, through their session (RLS enforced), and
 *   - `username → id` resolution for URL routing, which must work before a
 *     session row is known and therefore uses the service client.
 *
 * Resolution deliberately returns only the id and username: nothing else about
 * another account is ever exposed to a visitor.
 */

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

/** The signed-in user's profile, or null when the row is missing. */
export async function getProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return data as UserProfile;
}

/** Case-insensitive username lookup used by routes. Never throws. */
export async function resolveUsername(
  username: string
): Promise<{ id: string; username: string } | null> {
  const wanted = normalizeUsername(username);
  if (!wanted) return null;
  try {
    const service = await createServiceClient();
    const { data } = await service
      .from("profiles")
      .select("id, username")
      .ilike("username", wanted)
      .maybeSingle();
    if (data?.id && data?.username) {
      return { id: data.id as string, username: data.username as string };
    }
  } catch {
    // Service client unavailable → treated as "no such user" rather than
    // crashing the page. The caller renders its not-found state.
  }
  return null;
}

/** Produce a username that is free, valid, and recognisably derived from `desired`. */
export async function uniqueUsername(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  desired: string
): Promise<string> {
  const normalized = normalizeUsername(desired);
  const base =
    usernameError(normalized) === null
      ? normalized
      : usernameFromEmail(`${normalized}@zerokore.local`);

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .ilike("username", `${base}%`);
  const taken = new Set(
    (data ?? []).map((r: { username: string | null }) =>
      (r.username ?? "").toLowerCase()
    )
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 20)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Guarantee a profile row with a username for a signed-in user.
 *
 * Accounts created before usernames existed (or whose trigger row was lost)
 * self-heal here, so `/username/...` URLs never break for an existing account.
 */
export async function ensureProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  user: User
): Promise<UserProfile | null> {
  const existing = await getProfile(supabase, user.id);
  if (existing?.username) return existing;

  const desired =
    (user.user_metadata?.user_name as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    usernameFromEmail(user.email ?? "");

  const username = await uniqueUsername(supabase, desired);
  const row = {
    id: user.id,
    username,
    display_name: existing?.display_name ?? null,
    role: existing?.role ?? "user",
  };

  const { data } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("id, username, display_name, role, created_at")
    .maybeSingle();

  return (data as UserProfile) ?? null;
}
