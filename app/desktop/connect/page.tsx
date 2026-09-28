"use client";

import { useEffect } from "react";

/**
 * Step 2 of device sign-in: the browser lands here after signing in, and the
 * app waits. The server route consumes the one-time code and hands the app a
 * grant, so all this page has to do is follow the redirect and keep the user
 * informed.
 *
 * The whole flow is three steps and the user only ever sees a real browser
 * sign-in, which is why it works at all: Google and GitHub block embedded
 * webviews, so an in-app login form could never finish.
 */
export default function DesktopConnectPage() {
  // A real navigation to the server route, which consumes the one-time code
  // and returns the page that bounces the browser to `zerokore://auth?grant=…`.
  // This component only exists to show something before that navigation lands.
  useEffect(() => {
    window.location.href = `/api/auth/device/connect${window.location.search}`;
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-black px-6 text-[#e8e8e8]">
      <div className="w-full max-w-sm text-center">
        <p className="font-mono text-[11px] tracking-[0.28em] text-[#b5cfa0]">
          ZEROKORE DESKTOP
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Almost there</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#8a8a8a]">
          Connecting the app. This window will close by itself — return to
          ZeroKore Desktop.
        </p>
      </div>
    </main>
  );
}
