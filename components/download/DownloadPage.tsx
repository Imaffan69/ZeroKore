"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Download,
  Terminal,
  Copy,
  Check,
  Monitor,
  Apple,
  Layers,
  ShieldCheck,
  HardDriveDownload,
  RefreshCw,
} from "lucide-react";
import { EASE, fadeUp, staggerGroup } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Download page for ZeroKore Desktop and the CLI.
 *
 * Everything here is real: the installer version matches `package.json`, the
 * size is the size of the artefact actually built, and the commands are the
 * ones in `package.json`. OS detection only changes which button is
 * highlighted — it never hides a platform that exists.
 */

const RELEASE_BASE =
  process.env.NEXT_PUBLIC_RELEASE_BASE ??
  "https://github.com/Imaffan69/ZeroKore/releases";

const WINDOWS_ASSET = "ZeroKore-Desktop-1.0.0-x64.exe";
const INSTALLER_MB = 166;

type Platform = "windows" | "macos" | "linux";

function detect(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

const CLI_COMMANDS = [
  { label: "Run it from the repo", command: "npx zerokore login", note: "No global install." },
  { label: "Install globally", command: "npm install -g zerokore", note: "Then: zerokore" },
  {
    label: "Build the desktop app",
    command: "npm install && npm run desktop:package",
    note: "Writes the installer to release/.",
  },
];

function CopyBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-3">
      <code className="flex-1 overflow-x-auto font-mono text-[12px] text-kore-text">
        {command}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="shrink-0 rounded-lg border border-white/10 p-1.5 text-kore-muted transition hover:border-white/25 hover:text-white"
        aria-label={`Copy: ${command}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[#4ade80]" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}

const PLATFORMS: { id: Platform; label: string; icon: typeof Monitor; note: string }[] = [
  { id: "windows", label: "Windows", icon: Monitor, note: "built" },
  { id: "macos", label: "macOS", icon: Apple, note: "from source" },
  { id: "linux", label: "Linux", icon: Layers, note: "from source" },
];

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>("windows");

  useEffect(() => {
    setPlatform(detect());
  }, []);

  return (
    <main className="relative min-h-dvh bg-kore-bg text-kore-text">
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="font-mono text-[10px] tracking-[0.28em] text-kore-accent"
        >
          DOWNLOAD
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          className="mt-4 text-[clamp(2.2rem,6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white"
        >
          ZeroKore on your machine.
          <br />
          <span className="bg-gradient-to-r from-[#b5cfa0] via-white to-white bg-clip-text text-transparent">
            Native, not a tab.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          className="mt-5 max-w-2xl text-base leading-relaxed text-kore-body"
        >
          One signed-in account, two ways to work. The desktop app is a real IDE
          with a live file tree, Monaco and a real PowerShell or bash terminal on
          your own disk. The CLI does the same from your prompt.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.18 }}
          className="mt-8 flex flex-wrap gap-2"
        >
          {PLATFORMS.map(({ id, label, icon: Icon, note }) => (
            <span
              key={id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                platform === id
                  ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-white"
                  : "border-white/10 text-kore-muted"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
              <span className="font-mono text-[10px] text-kore-faint">{note}</span>
            </span>
          ))}
        </motion.div>

        <motion.section
          initial="hidden"
          animate="visible"
          variants={staggerGroup(0.08, 0.2)}
          className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
        >
          <motion.div variants={fadeUp} className="glass glass-sheen rounded-2xl p-6">
            <div className="flex items-center gap-2.5">
              <Download className="h-5 w-5 text-[#4ade80]" aria-hidden />
              <h2 className="text-base font-semibold text-white">
                ZeroKore Desktop for Windows
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-kore-muted">
              A full IDE: real file tree, Monaco editor, a live terminal running a
              genuine shell, and the same agent and projects you use in the
              browser.
            </p>

            <a
              href={RELEASE_BASE + "/download/" + WINDOWS_ASSET}
              className="group mt-5 inline-flex items-center gap-2.5 rounded-full bg-[#4ade80] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#b5cfa0]"
            >
              <HardDriveDownload className="h-4 w-4" aria-hidden />
              Download for Windows
              <span className="font-mono text-[11px] opacity-70">
                {" "}· {INSTALLER_MB} MB
              </span>
            </a>

            <p className="mt-3 font-mono text-[11px] text-kore-faint">
              {WINDOWS_ASSET} · x64 · NSIS installer
            </p>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-kore-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Sandboxed renderer
              </span>
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                In-app updates
              </span>
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" aria-hidden />
                Real shell
              </span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white">Before you install</h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-kore-muted">
              <li>
                <strong className="text-white">No code signing yet.</strong>{" "}
                Windows SmartScreen shows a warning on first run — choose{" "}
                <em>More info, then Run anyway</em>. It is our own unsigned build.
              </li>
              <li>
                <strong className="text-white">Per-user install.</strong> No admin
                rights needed, and uninstalling is a normal Windows operation.
              </li>
              <li>
                <strong className="text-white">Your files stay yours.</strong> The
                app can only read inside the folder you open.
              </li>
            </ul>
            <Link
              href="/desktop"
              className="mt-4 inline-block text-sm text-kore-accent underline underline-offset-2"
            >
              Full desktop docs
            </Link>
          </motion.div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
          className="glass glass-sheen mt-4 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-kore-accent" aria-hidden />
            <h2 className="text-base font-semibold text-white">ZeroKore CLI</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-kore-muted">
            Sign in once, then drive your projects, files and agent from the
            terminal. The session renews itself, so it keeps working day to day.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {CLI_COMMANDS.map((c) => (
              <div key={c.command}>
                <p className="font-mono text-[10px] tracking-[0.16em] text-kore-muted">
                  {c.label.toUpperCase()}
                </p>
                <CopyBlock command={c.command} />
                <p className="mt-1.5 text-[11px] text-kore-faint">{c.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              "login",
              "projects",
              "new <name>",
              "files <slug>",
              "cat <slug> <path>",
              'ask "..."',
            ].map((c) => (
              <code
                key={c}
                className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-[11px] text-kore-text"
              >
                zerokore {c}
              </code>
            ))}
          </div>
        </motion.section>

        <p className="mt-8 text-xs leading-relaxed text-kore-muted">
          The installer is published as a GitHub release rather than hosted by
          the site, so the 166 MB binary is served from the release CDN instead of
          on every page load. If the direct link 404s, build it yourself with{" "}
          <code className="font-mono">npm run desktop:package</code> — it lands in{" "}
          <code className="font-mono">release/</code>.
        </p>
      </div>
    </main>
  );
}
