import { NextRequest, NextResponse } from "next/server";
import { issueSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({} as any));
  if (!email || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const expectedEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedEmail || !passwordHash) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  if (email.toLowerCase() !== expectedEmail || !verifyPassword(password, passwordHash)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  issueSession(expectedEmail);
  return NextResponse.json({ ok: true });
}
