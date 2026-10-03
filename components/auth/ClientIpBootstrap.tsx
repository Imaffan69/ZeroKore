"use client";

import { useEffect } from "react";
import { fetchClientIp, NEEDS_IP_COOKIE, CLIENT_IP_COOKIE, hasCookie } from "@/lib/client-ip";

/**
 * Establishes the browser-reported address for the paths that never touch the
 * sign-in form.
 *
 * OAuth (Google, GitHub) leaves the browser entirely: the round-trip happens
 * between Supabase and `/auth/callback`, so the client code that asks for an
 * address never runs. Those routes notice that they could not see a routable
 * client address and set `zk_needs_ip`; this component answers it once the
 * browser is back, which writes `zk_client_ip`. Every later server-recorded
 * event — agent runs, file edits, GitHub syncs — then carries the real address
 * instead of the proxy's.
 *
 * Renders nothing, does no work on a healthy deployment (no flag cookie), and
 * never throws: telemetry must not become a failure mode for the app.
 */
export default function ClientIpBootstrap() {
  useEffect(() => {
    if (!hasCookie(NEEDS_IP_COOKIE)) return;
    if (hasCookie(CLIENT_IP_COOKIE)) {
      clearFlag();
      return;
    }
    let cancelled = false;
    void fetchClientIp().finally(() => {
      if (!cancelled) clearFlag();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

/** Retire the flag so this runs at most once per sign-in. */
function clearFlag() {
  try {
    document.cookie = `${NEEDS_IP_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Cookies can be blocked; worst case the check runs again next page load.
  }
}