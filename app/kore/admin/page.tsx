import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/require-session";
import { createClient } from "@/lib/supabase/server";
import { getRbac } from "@/lib/rbac";
import AdminPanel from "@/components/admin/AdminPanel";

/**
 * Hidden admin panel. Never linked, noindex, and rendered as an ordinary 404
 * for anyone below admin rank — indistinguishable from a missing page.
 */
export const metadata: Metadata = {
  title: "404",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function KoreAdminPage() {
  // Check auth first, without redirecting — anonymous visitors get an
  // ordinary 404 so the panel's existence is never revealed.
  const user = await getSession();
  if (!user) notFound();

  const supabase = await createClient();
  const rbac = await getRbac(supabase, user.id, user.email);
  // Logged-in users below staff rank also get an ordinary 404.
  if (!rbac.isStaff) notFound();

  return <AdminPanel role={rbac.role} isOwner={rbac.isOwner} />;
}
