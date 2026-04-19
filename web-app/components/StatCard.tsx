import { cn, formatNumber, percentChange } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  compareTo?: number | null;
  compareLabel?: string;
  className?: string;
};

export function StatCard({ label, value, compareTo, compareLabel, className }: Props) {
  const pct = typeof compareTo === "number" ? percentChange(value, compareTo) : null;
  const toneClass =
    pct === null ? "text-muted" : pct >= 0 ? "text-good" : "text-bad";

  return (
    <div className={cn("bg-surface border border-border rounded-lg p-4", className)}>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{formatNumber(value)}</div>
      {pct !== null && (
        <div className={cn("text-xs mt-1", toneClass)}>
          {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%{compareLabel ? ` vs ${compareLabel}` : ""}
        </div>
      )}
    </div>
  );
}
