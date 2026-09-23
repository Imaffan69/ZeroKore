import { NextResponse } from "next/server";

/**
 * Legacy/defensive OAuth landing: some flows arrived at `/code?...` instead of
 * `/auth/callback` (the "redirected to zerokore.vercel.app/code?4u27" report).
 * Forward everything to the real callback so the code still exchanges.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = new URL("/auth/callback", url.origin);
  url.searchParams.forEach((value, key) => {
    if (key !== "next") target.searchParams.set(key, value);
  });
  if (!target.searchParams.has("next")) {
    target.searchParams.set("next", "/dashboard");
  }
  return NextResponse.redirect(target, 307);
}
