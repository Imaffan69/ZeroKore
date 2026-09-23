import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession, isAdminConfigured } from "@/lib/admin-auth";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

/**
 * Admin login page. Only shown when admin auth is configured.
 * If already authenticated, redirect to the panel.
 */
export const metadata: Metadata = {
  title: "404",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (!isAdminConfigured()) {
    // Admin auth not configured — show 404 to everyone.
    redirect("/kore");
  }

  if (session.authenticated) {
    redirect("/kore/admin");
  }

  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <AdminLoginForm />
    </>
  );
}
