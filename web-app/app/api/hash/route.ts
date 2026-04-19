/**
 * Dev-only helper: GET /api/hash?password=xxx returns a scrypt hash for
 * ADMIN_PASSWORD_HASH. Disabled in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }
  const pw = new URL(req.url).searchParams.get("password");
  if (!pw) return NextResponse.json({ error: "missing ?password=" }, { status: 400 });
  return NextResponse.json({ hash: hashPassword(pw) });
}
