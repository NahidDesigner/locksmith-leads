import Link from "next/link";
import {
  supabaseAdmin,
  type TopPathRow,
  type TopReferrerRow,
} from "@/lib/supabase";
import {
  VisitorTrendChart,
  type VisitorTrendPoint,
} from "@/components/VisitorTrendChart";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { range?: string; site_id?: string };

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABEL: Record<string, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
};

export default async function VisitorsAnalytics({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const db = supabaseAdmin();

  const range =
    searchParams.range && RANGE_DAYS[searchParams.range]
      ? searchParams.range
      : "30d";
  const days = RANGE_DAYS[range];
  const siteFilter = searchParams.site_id || null;
  const fromDate = new Date(Date.now() - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);

  // Sites list powers the dropdown and the per-site breakdown table.
  const { data: sites } = await db
    .from("sites")
    .select("id, domain, display_name")
    .eq("is_active", true)
    .order("display_name");
  const activeSite = sites?.find((s) => s.id === siteFilter) ?? null;

  // Daily rollups already pre-aggregated per site — cheap to pull and
  // sum in-app. visitor_daily caps at 90d which matches our max range.
  let dailyQ = db
    .from("visitor_daily")
    .select("site_id, day, visitors, pageviews")
    .gte("day", fromDate);
  if (siteFilter) dailyQ = dailyQ.eq("site_id", siteFilter);
  const { data: dailyRaw } = await dailyQ;

  // Scaffold every day in the range so gaps render as zeros instead of
  // collapsing the X-axis.
  const dayList: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  const trendMap = new Map<string, VisitorTrendPoint>();
  for (const d of dayList) trendMap.set(d, { day: d, visitors: 0, pageviews: 0 });
  for (const row of (dailyRaw ?? []) as Array<{
    day: string;
    visitors: number;
    pageviews: number;
  }>) {
    const p = trendMap.get(row.day);
    if (!p) continue;
    // session_hash incorporates site_id, so summing visitors across
    // sites does not double-count a person who visited two sites the
    // same day — they're genuinely two separate sessions.
    p.visitors += row.visitors;
    p.pageviews += row.pageviews;
  }
  const trendData = Array.from(trendMap.values());

  const totalVisitors = trendData.reduce((s, p) => s + p.visitors, 0);
  const totalPageviews = trendData.reduce((s, p) => s + p.pageviews, 0);
  const pagesPerVisit = totalVisitors > 0 ? totalPageviews / totalVisitors : 0;
  const peakDay = trendData.reduce(
    (best, p) => (p.visitors > best.visitors ? p : best),
    { day: "", visitors: 0, pageviews: 0 } as VisitorTrendPoint
  );

  const { data: topPathsRaw } = await db.rpc("pageviews_top_paths", {
    p_site_id: siteFilter,
    p_from: fromDate,
    p_limit: 15,
  });
  const topPaths = (topPathsRaw ?? []) as TopPathRow[];

  const { data: topReferrersRaw } = await db.rpc("pageviews_top_referrers", {
    p_site_id: siteFilter,
    p_from: fromDate,
    p_limit: 25, // grab extra so we still have items after self-ref filter
  });
  const topReferrersAll = (topReferrersRaw ?? []) as TopReferrerRow[];

  // When a specific site is selected, hide its own hostname from the
  // referrer list — that's internal navigation, not a traffic source.
  const selfHost = activeSite
    ? activeSite.domain
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "")
        .replace(/^www\./, "")
        .toLowerCase()
    : null;
  const topReferrers = (selfHost
    ? topReferrersAll.filter(
        (r) =>
          r.host === "(direct)" ||
          r.host.replace(/^www\./, "").toLowerCase() !== selfHost
      )
    : topReferrersAll
  ).slice(0, 15);

  // Per-site breakdown only makes sense when no site filter is active.
  const perSiteRows: Array<{
    site_id: string;
    display_name: string;
    domain: string;
    visitors: number;
    pageviews: number;
  }> = [];
  if (!siteFilter && sites) {
    const bySite = new Map<string, { visitors: number; pageviews: number }>();
    for (const row of (dailyRaw ?? []) as Array<{
      site_id: string;
      visitors: number;
      pageviews: number;
    }>) {
      const cur = bySite.get(row.site_id) ?? { visitors: 0, pageviews: 0 };
      cur.visitors += row.visitors;
      cur.pageviews += row.pageviews;
      bySite.set(row.site_id, cur);
    }
    for (const s of sites) {
      const agg = bySite.get(s.id) ?? { visitors: 0, pageviews: 0 };
      perSiteRows.push({
        site_id: s.id,
        display_name: s.display_name,
        domain: s.domain,
        visitors: agg.visitors,
        pageviews: agg.pageviews,
      });
    }
    perSiteRows.sort((a, b) => b.visitors - a.visitors);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Visitors</h1>
          <div className="text-sm text-muted mt-1">
            {RANGE_LABEL[range]}
            {activeSite && (
              <>
                {" · "}
                <span className="text-fg">{activeSite.display_name}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <Filters sites={sites ?? []} range={range} siteId={siteFilter} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Visitors" value={formatNumber(totalVisitors)} />
        <Kpi label="Page views" value={formatNumber(totalPageviews)} />
        <Kpi
          label="Pages / visit"
          value={totalVisitors > 0 ? pagesPerVisit.toFixed(1) : "—"}
        />
        <Kpi
          label="Peak day"
          value={peakDay.visitors > 0 ? formatNumber(peakDay.visitors) : "—"}
          hint={peakDay.visitors > 0 ? formatDay(peakDay.day) : undefined}
        />
      </div>

      <VisitorTrendChart data={trendData} rangeLabel={RANGE_LABEL[range]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TableCard title="Top pages">
          <table className="w-full text-sm">
            <thead className="bg-bg text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-2">Path</th>
                <th className="text-right px-4 py-2 w-[90px]">Views</th>
                <th className="text-right px-4 py-2 w-[90px]">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {topPaths.map((p) => (
                <tr key={p.path} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs truncate max-w-md">
                    {p.path}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(p.views)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">
                    {formatNumber(p.visitors)}
                  </td>
                </tr>
              ))}
              {topPaths.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted text-sm"
                  >
                    No page views in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Top referrers">
          <table className="w-full text-sm">
            <thead className="bg-bg text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-right px-4 py-2 w-[90px]">Views</th>
                <th className="text-right px-4 py-2 w-[90px]">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {topReferrers.map((r) => (
                <tr key={r.host} className="border-t border-border">
                  <td className="px-4 py-2 text-xs truncate max-w-md">
                    {r.host}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(r.views)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">
                    {formatNumber(r.visitors)}
                  </td>
                </tr>
              ))}
              {topReferrers.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted text-sm"
                  >
                    No referrer data in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>
      </div>

      {!siteFilter && perSiteRows.length > 0 && (
        <section className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm uppercase tracking-wider text-muted border-b border-border">
            By site — {RANGE_LABEL[range]}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-bg text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-2">Site</th>
                <th className="text-right px-4 py-2 w-[120px]">Visitors</th>
                <th className="text-right px-4 py-2 w-[120px]">Page views</th>
                <th className="text-right px-4 py-2 w-[120px]">
                  Pages / visit
                </th>
              </tr>
            </thead>
            <tbody>
              {perSiteRows.map((s) => (
                <tr key={s.site_id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/visitors?range=${range}&site_id=${s.site_id}`}
                      className="hover:text-accent"
                    >
                      <div>{s.display_name}</div>
                      <div className="text-xs text-muted">{s.domain}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(s.visitors)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(s.pageviews)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">
                    {s.visitors > 0
                      ? (s.pageviews / s.visitors).toFixed(1)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

function TableCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 text-sm uppercase tracking-wider text-muted border-b border-border">
        {title}
      </div>
      {children}
    </section>
  );
}

function Filters({
  sites,
  range,
  siteId,
}: {
  sites: Array<{ id: string; display_name: string; domain: string }>;
  range: string;
  siteId: string | null;
}) {
  function href(next: { range?: string; site_id?: string | null }) {
    const p = new URLSearchParams();
    const r = next.range ?? range;
    const s = next.site_id === undefined ? siteId : next.site_id;
    if (r !== "30d") p.set("range", r);
    if (s) p.set("site_id", s);
    const qs = p.toString();
    return qs ? `?${qs}` : "/dashboard/visitors";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 bg-surface border border-border rounded p-1">
        {(["7d", "30d", "90d"] as const).map((r) => (
          <Link
            key={r}
            href={href({ range: r })}
            className={
              range === r
                ? "text-xs px-3 py-1 rounded bg-accent text-white"
                : "text-xs px-3 py-1 rounded text-muted hover:text-slate-200"
            }
          >
            {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
          </Link>
        ))}
      </div>
      <form method="get" className="flex items-center gap-2">
        {range !== "30d" && <input type="hidden" name="range" value={range} />}
        <select
          name="site_id"
          defaultValue={siteId ?? ""}
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
        <button className="text-sm bg-accent text-white rounded px-3 py-1.5">
          Apply
        </button>
      </form>
      {siteId && (
        <Link
          href={href({ site_id: null })}
          className="text-xs text-muted hover:text-slate-200 underline"
        >
          Clear site filter
        </Link>
      )}
    </div>
  );
}

function formatDay(day: string) {
  if (!day) return "";
  const d = new Date(day);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
