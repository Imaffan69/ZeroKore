import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace — ZeroKore",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-kore-bg text-kore-text">
      {children}
    </div>
  );
}