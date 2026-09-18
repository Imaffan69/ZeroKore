import type { Metadata } from "next";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Settings",
};

/** Settings: account, models, integrations (GitHub) and system status. */
export default async function SettingsPage() {
  const user = await requireSession("/settings");

  return (
    <div className="flex h-dvh w-full flex-col bg-kore-bg text-kore-text">
      <SettingsScreen email={user.email ?? ""} />
    </div>
  );
}