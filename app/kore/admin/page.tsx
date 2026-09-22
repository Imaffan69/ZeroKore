import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
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
  const user = await requireSession("/kore/admin");
  const supabase = await createClient();
  const rbac = await getRbac(supabase, user.id);
  if (!rbac.isAdmin) notFound();

  return <AdminPanel role={rbac.role} isOwner={rbac.isOwner} />;
}
