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
  // Staff account (username + password) takes precedence when configured.
  const adminSession = await getAdminSession();
  if (adminSession.authenticated) {
    return (
      <AdminPanel
        role={adminSession.role}
        isOwner={adminSession.isOwner}
        adminUsername={adminSession.username}
      />
    );
  }

  // If any admin credential exists, show the login form rather than a 404 so
  // staff can sign in (still invisible: nothing links here).
  const dbConfigured = await isAdminConfigured();
  if (dbConfigured) {
    return <AdminPanel role="user" isOwner={false} showLogin />;
  }

  // Otherwise fall back to Supabase staff auth.
  const user = await getSession();
  if (!user) notFound();

  const supabase = await createClient();
  const rbac = await getRbac(supabase, user.id, user.email);
  if (!rbac.isStaff) notFound();

  return <AdminPanel role={rbac.role} isOwner={rbac.isOwner} adminUsername={user.email ?? undefined} />;
}
