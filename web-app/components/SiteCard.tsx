import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { Sparkline, type SparkPoint } from "./Sparkline";
import { LocalTime } from "./LocalTime";
import { formatNumber, percentChange } from "@/lib/utils";
import type { SiteStatsRow, VisitorStatsRow } from "@/lib/supabase";

type Props = {
  site: SiteStatsRow;
  visitors?: VisitorStatsRow | null;
  submissionsWeekly: SparkPoint[];   // last 7 days
  visitorsMonthly?: SparkPoint[];    // last 30 days
};

export function SiteCard({ site, visitors, submissionsWeekly, visitorsMonthly }: Props) {
  const subPct = percentChange(site.last_7d, site.prior_7d);
  const subTone = toneFor(subPct);

  const visPct = visitors ? percentChange(visitors.visitors_7d, visitors.visitors_prior_7d) : null;
  const visTone = toneFor(visPct);

  // Domain in DB may be stored with protocol + trailing slash (e.g.
  // "https://foo.com/") or without ("foo.com"). Normalize for display
  // and always produce a well-formed external href.
  const bareDomain = site.domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const href = `https://${bareDomain}`;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{site.display_name}</div>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted hover:text-accent truncate block"
          >
            {bareDomain}
          </a>
        </div>
        <HealthBadge lastHeartbeatAt={site.last_heartbeat_at} />
      </div>

      {/* Submissions */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted">Submissions</span>
          <span className="text-xs text-muted">{formatNumber(site.total_submissions)} total</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <Stat label="24h" value={site.last_24h} />
          <Stat label="7d" value={site.last_7d} tone={subTone} sub={pctLabel(subPct)} />
          <Stat label="30d" value={site.last_30d} />
        </div>
        <Sparkline data={submissionsWeekly} color="#22c55e" height={48} />
      </section>

      {/* Visitors */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted">Visitors</span>
          <span className="text-xs text-muted">
            {visitors ? `${formatNumber(visitors.pageviews_30d)} page views · 30d` : "no data yet"}
          </span>
        </div>
        {visitors ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mb-2">
              <Stat label="24h" value={visitors.visitors_24h} />
              <Stat label="7d" value={visitors.visitors_7d} tone={visTone} sub={pctLabel(visPct)} />
              <Stat label="30d" value={visitors.visitors_30d} />
            </div>
            <Sparkline data={visitorsMonthly ?? []} color="#3b82f6" height={48} label="visitors" />
          </>
        ) : (
          <div className="text-xs text-muted italic py-4 text-center border border-dashed border-border rounded">
            Beacon not received yet — make sure plugin v1.0.6+ is active on this site.
          </div>
        )}
      </section>

      <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
        <span className="text-muted">
          Last lead:{" "}
          <LocalTime
            iso={site.last_submission_at}
            mode="relative"
            className="text-fg"
          />
        </span>
        <Link
          href={`/dashboard/submissions?site_id=${site.site_id}`}
          className="text-accent hover:underline"
        >
          View submissions →
        </Link>
      </div>
    </div>
  );
}

function toneFor(pct: number | null) {
  if (pct === null) return "text-muted";
  if (pct >= 0) return "text-good";
  if (pct <= -30) return "text-bad";
  return "text-warn";
}

function pctLabel(pct: number | null): string | null {
  if (pct === null) return null;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: string; sub?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{formatNumber(value)}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${tone ?? "text-muted"}`}>{sub}</div>}
    </div>
  );
}
