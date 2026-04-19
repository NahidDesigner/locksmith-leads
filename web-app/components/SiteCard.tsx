import Link from "next/link";
import { Sparkline, type SparkPoint } from "./Sparkline";
import { LocalTime } from "./LocalTime";
import { formatNumber, percentChange } from "@/lib/utils";
import type { SiteStatsRow, VisitorStatsRow } from "@/lib/supabase";

type Props = {
  site: SiteStatsRow;
  visitors?: VisitorStatsRow | null;
  submissionsMonthly: SparkPoint[];
  visitorsMonthly?: SparkPoint[];
};

export function SiteCard({ site, visitors, submissionsMonthly, visitorsMonthly }: Props) {
  const subPct = percentChange(site.last_7d, site.prior_7d);
  const visPct = visitors ? percentChange(visitors.visitors_7d, visitors.visitors_prior_7d) : null;

  const bareDomain = site.domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const href = `https://${bareDomain}`;

  return (
    <div className="bg-surface border border-border rounded-lg flex flex-col overflow-hidden hover:border-accent/40 transition-colors">
      <div className="px-5 pt-5 pb-4 border-b border-border/60">
        <div className="min-w-0">
          <div className="font-semibold truncate">{site.display_name}</div>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted hover:text-accent truncate block mt-0.5"
          >
            {bareDomain}
          </a>
        </div>
      </div>

      <MetricBlock
        label="Submissions"
        secondary={`${formatNumber(site.total_submissions)} all-time`}
        primary={site.last_7d}
        primaryLabel="last 7 days"
        pct={subPct}
        sideStats={[
          { value: site.last_24h, label: "today" },
          { value: site.last_30d, label: "30d" },
        ]}
        spark={submissionsMonthly}
        color="#22c55e"
      />

      <div className="h-px bg-border/60 mx-5" />

      {visitors ? (
        <MetricBlock
          label="Visitors"
          secondary={`${formatNumber(visitors.pageviews_30d)} page views · 30d`}
          primary={visitors.visitors_7d}
          primaryLabel="last 7 days"
          pct={visPct}
          sideStats={[
            { value: visitors.visitors_24h, label: "today" },
            { value: visitors.visitors_30d, label: "30d" },
          ]}
          spark={visitorsMonthly ?? []}
          color="#3b82f6"
          sparkLabel="visitors"
        />
      ) : (
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-muted">Visitors</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted border border-dashed border-border rounded px-3 py-3">
            <span className="inline-block w-2 h-2 rounded-full bg-warn" />
            <span className="flex-1">
              No beacon data yet. Install plugin v1.0.6+ and purge page caches.
            </span>
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-border px-5 py-3 flex items-center justify-between text-xs">
        <span className="text-muted">
          Last lead{" "}
          <LocalTime
            iso={site.last_submission_at}
            mode="relative"
            className="text-fg font-medium"
          />
        </span>
        <Link
          href={`/dashboard/submissions?site_id=${site.site_id}`}
          className="text-accent hover:underline font-medium"
        >
          View submissions →
        </Link>
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  secondary,
  primary,
  primaryLabel,
  pct,
  sideStats,
  spark,
  color,
  sparkLabel,
}: {
  label: string;
  secondary: string;
  primary: number;
  primaryLabel: string;
  pct: number | null;
  sideStats: Array<{ value: number; label: string }>;
  spark: SparkPoint[];
  color: string;
  sparkLabel?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
        <span className="text-xs text-muted">{secondary}</span>
      </div>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-end gap-2">
          <div>
            <div className="text-3xl font-semibold leading-none tabular-nums">
              {formatNumber(primary)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted mt-1.5">
              {primaryLabel}
            </div>
          </div>
          {pct !== null && <DeltaPill pct={pct} />}
        </div>
        <div className="text-right text-xs space-y-1">
          {sideStats.map((s) => (
            <div key={s.label} className="tabular-nums">
              <span className="font-medium text-fg">{formatNumber(s.value)}</span>
              <span className="text-muted ml-1">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <Sparkline data={spark} color={color} height={56} label={sparkLabel} />
    </div>
  );
}

function DeltaPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  const tone =
    up ? "text-good bg-good/10" :
    pct <= -30 ? "text-bad bg-bad/10" :
                 "text-warn bg-warn/10";
  const arrow = up ? "▲" : "▼";
  return (
    <div className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none ${tone}`}>
      <span className="text-[9px]">{arrow}</span>
      <span>{Math.abs(pct).toFixed(0)}%</span>
    </div>
  );
}
