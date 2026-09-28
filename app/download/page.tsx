import type { Metadata } from "next";
import DownloadPage from "@/components/download/DownloadPage";

export const metadata: Metadata = {
  title: "Download — ZeroKore Desktop & CLI",
  description:
    "Download ZeroKore Desktop for Windows, or install the ZeroKore CLI and drive your projects, files and agent from the terminal.",
};

export default function Page() {
  return <DownloadPage />;
}
