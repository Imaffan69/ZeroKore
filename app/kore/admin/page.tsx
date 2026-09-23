import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/require-session";
import { createClient } from "@/lib/supabase/server";
import { getRbac } from "@/lib/rbac";
import { getAdminSession, isAdminConfigured } from "@/lib/admin-auth";
import AdminPanel from "@/components/admin/AdminPanel";

/**
 * Hidden admin panel. Never linked, noindex, and rendered as an ordinary 404
 * for anyone without access — indistinguishable from a missing page.
 *
 * Access is granted to:
 *  - Staff accounts (owner/admin/moderator/support) via Supabase auth, OR
 *  - The admin password user (ADMIN_USERNAME + ADMIN_PASSWORD_HASH) via a
 *    separate password session cookie.
 */
export const metadata: Metadata = {
  title: "404",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function KoreAdminPage() {
  // Admin password session takes precedence if configured
  const adminSession = await getAdminSession();
  if (isAdminConfigured() && adminSession.authenticated) {
    return <AdminPanel role="admin" isOwner={false} adminAuth />;
  }

  // Otherwise fall back to Supabase staff auth
  const user = await getSession();
  if (!user) notFound();

  const supabase = await createClient();
  const rbac = await getRbac(supabase, user.id, user.email);
  if (!rbac.isStaff) notFound();

  return <AdminPanel role={rbac.role} isOwner={rbac.isOwner} />;
}
