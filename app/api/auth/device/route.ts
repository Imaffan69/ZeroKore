import { NextResponse } from "next/server";
import { issueCode } from "@/lib/auth/device-codes";

export const dynamic = "force-dynamic";

/**
 * Device sign-in — step 1 of 3 for the desktop app.
 *
 * Google and GitHub both refuse to authenticate inside an embedded webview, so
 * the app cannot sign the user in itself. The full flow is:
 *
 *   1. POST here -> a one-time `code` plus the browser URL to open
 *   2. the user signs in normally at /desktop/connect?code=…, and the server
 *      then hands the app a `grant` over `zerokore://auth?grant=…`
 *   3. the app exchanges that `grant` for a real session via /connect
 *
 * No session is required here: this only hands out a code.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;
    const code = issueCode();

    return NextResponse.json(
      { code, url: `${origin}/desktop/connect?code=${encodeURIComponent(code)}` },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not start sign-in. Try again." },
      { status: 500 }
    );
  }
}
