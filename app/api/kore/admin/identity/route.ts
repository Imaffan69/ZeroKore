import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({
    username: session.username || null,
    role: session.authenticated ? session.role : null,
    isOwner: session.isOwner,
    authenticated: session.authenticated,
  });
}
