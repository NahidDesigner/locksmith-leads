import { supabaseAdmin, type SiteStatsRow } from "@/lib/supabase";
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

  // Daily counts: last 30 days, one row per (site, day)
  const { data: daily } = await db
    .from("daily_counts")
    .select("site_id, day, count")
    .gte("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));

  // Build an empty 30-day scaffold (keeps days with 0 visible)
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    last30Days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  const last7Days = last30Days.slice(-7);

  // Per-site daily index: site_id → (day → count)
  const perSite = new Map<string, Map<string, number>>();
  for (const row of daily ?? []) {
    if (!perSite.has(row.site_id)) perSite.set(row.site_id, new Map());
    perSite.get(row.site_id)!.set(row.day, row.count);
  }

  function seriesFor(siteId: string, days: string[]): SparkPoint[] {
    const m = perSite.get(siteId);
    return days.map((d) => ({ day: d, count: m?.get(d) ?? 0 }));
  }

  // Aggregate trend line (all sites stacked by domain)
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Last 24h" value={totals.last_24h} />
        <StatCard label="Last 7 days" value={totals.last_7d} compareTo={totals.prior_7d} compareLabel="prior 7d" />
        <StatCard label="Last 30 days" value={totals.last_30d} />
        <StatCard label="All time" value={totals.total} />
      </div>

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
                weekly={seriesFor(s.site_id, last7Days)}
                monthly={seriesFor(s.site_id, last30Days)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
