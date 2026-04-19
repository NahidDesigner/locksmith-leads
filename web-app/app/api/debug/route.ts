import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only diagnostic — tells us which Supabase this deployment is hitting
// and whether data is actually landing. Delete once setup is verified.
export async function GET() {
  if (!getSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const [sitesRes, subsRes] = await Promise.all([
    db.from("sites").select("id, domain, display_name, last_submission_at, last_heartbeat_at, created_at"),
    db.from("submissions").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 14),
    sites_count: sitesRes.data?.length ?? 0,
    sites: sitesRes.data ?? [],
    sites_error: sitesRes.error?.message ?? null,
    submissions_count: subsRes.count ?? 0,
    submissions_error: subsRes.error?.message ?? null,
  });
}
