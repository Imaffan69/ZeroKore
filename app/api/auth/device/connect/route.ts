import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { issueGrant, takeCode, takeGrant } from "@/lib/auth/device-codes";

export const dynamic = "force-dynamic";

/**
 * Device sign-in — steps 2 and 3.
 *
 * Step 2 (GET): the user signed in in their real browser. We consume the
 * one-time code, bind a short-lived grant to that account, and hand it back to
 * the app over the custom protocol.
 *
 * Step 3 (POST): the app posts the grant and receives a real session.
 *
 * There is no Supabase admin call for "log in as this user", so step 3 asks the
 * service role for a single-use hashed token and then redeems it once with the
 * public client — an ordinary sign-in as far as Supabase is concerned, which
 * yields a normal access + refresh token pair.
 */

/** The browser lands here after signing in; hands the result to the app. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing sign-in code." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in first, then connect the desktop app." },
        { status: 401 }
      );
    }

    // Single-use: a replayed or stale code is simply gone.
    if (!takeCode(code)) {
      return NextResponse.json(
        { error: "This sign-in link has expired. Start again from the app." },
        { status: 410 }
      );
    }

    const grant = issueGrant(user.id);
    const appLink = `zerokore://auth?grant=${encodeURIComponent(grant)}`;

    // A custom-protocol link cannot be an HTTP redirect target, so return a
    // page the browser follows with a script.
    const html =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<meta name="robots" content="noindex">` +
      `<title>ZeroKore Desktop</title></head>` +
      `<body style="background:#000;color:#e8e8e8;font:16px system-ui;` +
      `display:grid;place-items:center;height:100vh;margin:0">` +
      `<div style="text-align:center">` +
      `<p style="font-family:ui-monospace,monospace;letter-spacing:.2em;` +
      `font-size:11px;color:#b5cfa0">ZEROKORE DESKTOP</p>` +
      `<h1 style="font-size:22px;margin:12px 0">Connected.</h1>` +
      `<p style="color:#8a8a8a">You can close this tab and go back to the app.</p>` +
      `</div><script>location.href=${JSON.stringify(appLink)};</script></body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not complete sign-in. Try again." },
      { status: 500 }
    );
  }
}

/** The app posts the grant here and receives a real session. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { grant?: unknown };
    const grant = typeof body.grant === "string" ? body.grant : "";
    if (!grant) {
      return NextResponse.json({ error: "Missing grant." }, { status: 400 });
    }

    const userId = takeGrant(grant);
    if (!userId) {
      return NextResponse.json(
        { error: "That sign-in link has expired. Try again." },
        { status: 410 }
      );
    }

    const service = await createServiceClient();

    // `generateLink` addresses a user by email, so resolve it from the id the
    // grant was bound to. The grant is already consumed, so a failure here just
    // asks the user to start again rather than leaving anything live.
    const { data: userRow, error: userError } =
      await service.auth.admin.getUserById(userId);
    const email = userRow?.user?.email;
    if (userError || !email) {
      return NextResponse.json(
        { error: "Could not create a session. Try again." },
        { status: 500 }
      );
    }

    const { data: link, error: linkError } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${new URL(req.url).origin}/auth/callback` },
      });
    if (linkError || !link?.properties?.hashed_token) {
      return NextResponse.json(
        { error: "Could not create a session. Try again." },
        { status: 500 }
      );
    }

    const publicClient = await createClient();
    const { data: session, error: sessionError } =
      await publicClient.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
      });

    if (sessionError || !session?.session) {
      return NextResponse.json(
        { error: "Could not create a session. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        accessToken: session.session.access_token,
        refreshToken: session.session.refresh_token,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not complete sign-in. Try again." },
      { status: 500 }
    );
  }
}
