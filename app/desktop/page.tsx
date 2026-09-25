import type { Metadata } from "next";
import Link from "next/link";
import { Download, Terminal } from "lucide-react";
import ProductPage from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Desktop — ZeroKore for Windows",
  description:
    "ZeroKore Desktop: a native Windows app for the ZeroKore workspace. Real window, native menus, your session — free to download.",
};

export default function DesktopPage() {
  return (
    <ProductPage
      label="DESKTOP"
      title="The workspace,"
      titleAccent="as a desktop app."
      sub="A real native Windows app, not a design mock. It opens the same ZeroKore workspace you use in the browser — same projects, agent, terminal and skills — in its own window with native menus and your session already signed in."
      replaces={["VS Code + Copilot", "Cursor", "Windsurf", "Zed", "Web-only tabs"]}
      features={[
        {
          title: "Real app, not a page in a frame",
          body: "ZeroKore Desktop is a native Windows application (Electron) with its own window, taskbar icon, Start-menu entry and installer. It launches in under a second and remembers your window size and position between sessions.",
        },
        {
          title: "Same account, same projects",
          body: "You sign in once and the desktop app keeps that session. Every project, environment, terminal and secret you have in the browser is there — nothing is duplicated, nothing is a separate copy to maintain.",
        },
        {
          title: "Native menu bar",
          body: "File, Edit, View, Go and Help menus that work like a real desktop app: reload, full-screen, zoom, dev tools, and quick jumps straight to Projects or Settings.",
        },
        {
          title: "Locked down, not wide open",
          body: "The renderer runs sandboxed with context isolation on and Node integration off. It cannot read your files, and any link that points off ZeroKore opens in your normal browser instead of hijacking the app window.",
        },
        {
          title: "Skills travel with you",
          body: "The same SKILL.md playbooks power web and desktop — author once, load anywhere with /skill-name. The desktop app runs the identical agent.",
        },
        {
          title: "Hand it a link",
          body: "The app registers the zerokore:// protocol, so a ZeroKore link can open straight into the desktop window instead of the browser tab.",
        },
      ]}
      primaryCta="Open the web workspace"
      primaryHref="/dashboard"
      secondaryCta="Create a free account"
      secondaryHref="/signup"
    >
      {/* Build it yourself — the app is open source and lives in this repo. */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="glass glass-sheen rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-kore-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-white">Build the installer</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-kore-muted">
            The desktop app is in this repository under{" "}
            <span className="font-mono text-kore-text">desktop/</span>. Clone the
            repo and produce the Windows installer yourself:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-kore-text">
{`npm install
npm run desktop          # run the app
npm run desktop:package  # build ZeroKore-Desktop-1.0.0-x64.exe`}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-kore-muted">
            The built installer is written to{" "}
            <span className="font-mono">release/</span>. No code signing is
            configured yet, so Windows SmartScreen may show a warning on first
            run — choose &ldquo;More info → Run anyway&rdquo;.
          </p>
        </div>

        <div className="glass glass-sheen rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-kore-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-white">Run against a local build</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-kore-muted">
            Working on the web app? Point the desktop shell at your dev server
            instead of production:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-kore-text">
{`npm run dev            # terminal 1
$env:ZEROKORE_DEV="1"
npm run desktop        # terminal 2`}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-kore-muted">
            DevTools are one keystroke away:{" "}
            <span className="font-mono">Ctrl+Shift+I</span>.
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-kore-muted">
        Prefer a hosted build or a signed installer?{" "}
        <Link href="/pricing" className="text-kore-accent underline underline-offset-2">
          See the plans
        </Link>{" "}
        or{" "}
        <Link href="/web" className="text-kore-accent underline underline-offset-2">
          use the web workspace
        </Link>{" "}
        — it is the same product and it works today in any browser.
      </p>
    </ProductPage>
  );
}
