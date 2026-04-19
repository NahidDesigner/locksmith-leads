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
  const [sitesRes, subsRes, statsRes, dailyRes, statusBreakdownRes] = await Promise.all([
    db.from("sites").select("id, domain, display_name, last_submission_at, last_heartbeat_at, created_at"),
    db.from("submissions").select("id", { count: "exact", head: true }),
    db.from("site_stats").select("*"),
    db.from("daily_counts").select("*").limit(5),
    db.from("submissions").select("status"),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of statusBreakdownRes.data ?? []) {
    const s = (r as { status: string }).status ?? "null";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 14),
    sites_count: sitesRes.data?.length ?? 0,
    sites: sitesRes.data ?? [],
    sites_error: sitesRes.error?.message ?? null,
    submissions_count: subsRes.count ?? 0,
    submissions_error: subsRes.error?.message ?? null,
    site_stats_count: statsRes.data?.length ?? 0,
    site_stats: statsRes.data ?? [],
    site_stats_error: statsRes.error?.message ?? null,
    daily_counts_sample: dailyRes.data ?? [],
    daily_counts_error: dailyRes.error?.message ?? null,
    status_breakdown: statusCounts,
    now_server: new Date().toISOString(),
  });
}
