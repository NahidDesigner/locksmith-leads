import { supabaseAdmin, type SiteStatsRow, type VisitorStatsRow } from "@/lib/supabase";
import { StatCard } from "@/components/StatCard";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { SiteCard } from "@/components/SiteCard";
import type { SparkPoint } from "@/components/Sparkline";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Overview() {
  const db = supabaseAdmin();

  const { data: stats } = await db.from("site_stats").select("*").order("last_7d", { ascending: false });
  const siteStats = (stats ?? []) as SiteStatsRow[];

  // Visitor stats may not exist yet if migration 004 hasn't been run —
  // swallow the error and treat as "no visitor data".
  const { data: visitorsData } = await db.from("visitor_stats").select("*");
  const visitorStatsById = new Map<string, VisitorStatsRow>(
    ((visitorsData ?? []) as VisitorStatsRow[]).map((v) => [v.site_id, v])
  );

  const totals = siteStats.reduce(
    (acc, s) => {
      acc.total += s.total_submissions;
      acc.last_24h += s.last_24h;
      acc.last_7d += s.last_7d;
      acc.last_30d += s.last_30d;
      acc.prior_7d += s.prior_7d;
      return acc;
    },
    { total: 0, last_24h: 0, last_7d: 0, last_30d: 0, prior_7d: 0 }
  );

  const visitorTotals = Array.from(visitorStatsById.values()).reduce(
    (acc, v) => {
      acc.v_24h += v.visitors_24h;
      acc.v_7d += v.visitors_7d;
      acc.v_30d += v.visitors_30d;
      acc.v_prior_7d += v.visitors_prior_7d;
      return acc;
    },
    { v_24h: 0, v_7d: 0, v_30d: 0, v_prior_7d: 0 }
  );
  const hasVisitorData = visitorStatsById.size > 0 && visitorTotals.v_30d > 0;

  // Daily submission counts: last 30 days
  const { data: daily } = await db
    .from("daily_counts")
    .select("site_id, day, count")
    .gte("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));

  const { data: visitorDaily } = await db
    .from("visitor_daily")
    .select("site_id, day, visitors")
    .gte("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));

  // Build an empty 30-day scaffold (keeps days with 0 visible)
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    last30Days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  const last7Days = last30Days.slice(-7);

  // Per-site daily indices: site_id → (day → count)
  const subsPerSite = new Map<string, Map<string, number>>();
  for (const row of daily ?? []) {
    if (!subsPerSite.has(row.site_id)) subsPerSite.set(row.site_id, new Map());
    subsPerSite.get(row.site_id)!.set(row.day, row.count);
  }
  const visPerSite = new Map<string, Map<string, number>>();
  for (const row of (visitorDaily ?? []) as Array<{ site_id: string; day: string; visitors: number }>) {
    if (!visPerSite.has(row.site_id)) visPerSite.set(row.site_id, new Map());
    visPerSite.get(row.site_id)!.set(row.day, row.visitors);
  }

  function subsSeries(siteId: string, days: string[]): SparkPoint[] {
    const m = subsPerSite.get(siteId);
    return days.map((d) => ({ day: d, count: m?.get(d) ?? 0 }));
  }
  function visSeries(siteId: string, days: string[]): SparkPoint[] {
    const m = visPerSite.get(siteId);
    return days.map((d) => ({ day: d, count: m?.get(d) ?? 0 }));
  }

  // Aggregate submissions trend line (all sites stacked by domain)
  const domainById = new Map(siteStats.map((s) => [s.site_id, s.domain]));
  const pointMap = new Map<string, TrendPoint>();
  for (const d of last30Days) pointMap.set(d, { day: d });
  for (const row of daily ?? []) {
    const p = pointMap.get(row.day);
    if (!p) continue;
    const domain = domainById.get(row.site_id);
    if (!domain) continue;
    p[domain] = ((p[domain] as number) ?? 0) + row.count;
  }
  const trendData = Array.from(pointMap.values());
  const domains = siteStats.map((s) => s.domain);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="text-sm text-muted">{siteStats.length} site{siteStats.length === 1 ? "" : "s"}</div>
      </header>

      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted mb-2">Submissions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Last 24h" value={totals.last_24h} />
          <StatCard label="Last 7 days" value={totals.last_7d} compareTo={totals.prior_7d} compareLabel="prior 7d" />
          <StatCard label="Last 30 days" value={totals.last_30d} />
          <StatCard label="All time" value={totals.total} />
        </div>
      </div>

      {hasVisitorData && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-2">Visitors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Last 24h" value={visitorTotals.v_24h} />
            <StatCard label="Last 7 days" value={visitorTotals.v_7d} compareTo={visitorTotals.v_prior_7d} compareLabel="prior 7d" />
            <StatCard label="Last 30 days" value={visitorTotals.v_30d} />
            <StatCard label="Sites reporting" value={visitorStatsById.size} />
          </div>
        </div>
      )}

      {domains.length > 0 && <TrendChart data={trendData} domains={domains} />}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3">By site</h2>
        {siteStats.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg px-4 py-10 text-center text-muted">
            No sites yet. <Link href="/dashboard/sites" className="text-accent">Add a site</Link> to start receiving submissions.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {siteStats.map((s) => (
              <SiteCard
                key={s.site_id}
                site={s}
                visitors={visitorStatsById.get(s.site_id) ?? null}
                submissionsWeekly={subsSeries(s.site_id, last7Days)}
                visitorsMonthly={visSeries(s.site_id, last30Days)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
