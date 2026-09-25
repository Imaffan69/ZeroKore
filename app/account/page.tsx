import type { Metadata } from "next";
import { requireSession } from "@/lib/require-session";
import AccountArea from "@/components/account/AccountArea";

export const metadata: Metadata = { title: "Account — ZeroKore" };

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireSession("/account");
  return <AccountArea email={user.email ?? ""} />;
}
