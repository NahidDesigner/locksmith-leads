import { supabaseAdmin, type SiteStatsRow } from "@/lib/supabase";
import { StatCard } from "@/components/StatCard";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { HealthBadge } from "@/components/HealthBadge";
import { formatNumber, formatRelative, percentChange } from "@/lib/utils";
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

  // Trend: daily counts for last 30 days, one series per site
  const { data: daily } = await db
    .from("daily_counts")
    .select("site_id, day, count")
    .gte("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));

  const domainById = new Map(siteStats.map((s) => [s.site_id, s.domain]));
  const pointMap = new Map<string, TrendPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    pointMap.set(d, { day: d });
  }
  for (const row of daily ?? []) {
    const p = pointMap.get(row.day);
    if (!p) continue;
    const domain = domainById.get(row.site_id);
    if (!domain) continue;
    p[domain] = (p[domain] as number ?? 0) + row.count;
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
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg text-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Site</th>
                <th className="text-left px-4 py-2">Health</th>
                <th className="text-right px-4 py-2">24h</th>
                <th className="text-right px-4 py-2">7d</th>
                <th className="text-right px-4 py-2">Δ vs prior 7d</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-right px-4 py-2">Last lead</th>
              </tr>
            </thead>
            <tbody>
              {siteStats.map((s) => {
                const pct = percentChange(s.last_7d, s.prior_7d);
                const dropped = pct !== null && pct <= -30;
                return (
                  <tr key={s.site_id} className="border-t border-border hover:bg-bg/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.display_name}</div>
                      <div className="text-xs text-muted">{s.domain}</div>
                    </td>
                    <td className="px-4 py-3"><HealthBadge lastHeartbeatAt={s.last_heartbeat_at} /></td>
                    <td className="px-4 py-3 text-right">{formatNumber(s.last_24h)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(s.last_7d)}</td>
                    <td className={`px-4 py-3 text-right ${pct === null ? "text-muted" : pct >= 0 ? "text-good" : dropped ? "text-bad font-medium" : "text-warn"}`}>
                      {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(s.total_submissions)}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatRelative(s.last_submission_at)}</td>
                  </tr>
                );
              })}
              {siteStats.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No sites yet. <Link href="/dashboard/sites" className="text-accent">Add a site</Link> to start receiving submissions.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
