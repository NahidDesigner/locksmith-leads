import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { Sparkline, type SparkPoint } from "./Sparkline";
import { LocalTime } from "./LocalTime";
import { formatNumber, percentChange } from "@/lib/utils";
import type { SiteStatsRow } from "@/lib/supabase";

type Props = {
  site: SiteStatsRow;
  weekly: SparkPoint[];   // last 7 days
  monthly: SparkPoint[];  // last 30 days
};

export function SiteCard({ site, weekly, monthly }: Props) {
  const pct = percentChange(site.last_7d, site.prior_7d);
  const dropped = pct !== null && pct <= -30;
  const pctTone =
    pct === null ? "text-muted" : pct >= 0 ? "text-good" : dropped ? "text-bad" : "text-warn";

  // Domain in DB may be stored with protocol + trailing slash
  // (e.g. "https://foo.com/") or without ("foo.com"). Normalize for display
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

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="24h" value={site.last_24h} />
        <Stat label="7d" value={site.last_7d} tone={pctTone} sub={pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`} />
        <Stat label="30d" value={site.last_30d} />
        <Stat label="Total" value={site.total_submissions} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wider text-muted">This week</span>
          <span className="text-xs text-muted">{formatNumber(site.last_7d)} total</span>
        </div>
        <Sparkline data={weekly} color="#22c55e" height={56} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wider text-muted">Last 30 days</span>
          <span className="text-xs text-muted">{formatNumber(site.last_30d)} total</span>
        </div>
        <Sparkline data={monthly} color="#3b82f6" height={56} />
      </div>

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

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{formatNumber(value)}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${tone ?? "text-muted"}`}>{sub}</div>}
    </div>
  );
}
