// Deterministic per-site color so multi-site tables stay scannable.
// Hash the domain → one of a curated set of tints.
const PALETTE = [
  { bg: "bg-[#3b82f6]/15", fg: "text-[#93c5fd]" }, // blue
  { bg: "bg-[#22c55e]/15", fg: "text-[#86efac]" }, // green
  { bg: "bg-[#eab308]/15", fg: "text-[#fde047]" }, // yellow
  { bg: "bg-[#f97316]/15", fg: "text-[#fdba74]" }, // orange
  { bg: "bg-[#ec4899]/15", fg: "text-[#f9a8d4]" }, // pink
  { bg: "bg-[#a855f7]/15", fg: "text-[#d8b4fe]" }, // purple
  { bg: "bg-[#06b6d4]/15", fg: "text-[#67e8f9]" }, // cyan
  { bg: "bg-[#ef4444]/15", fg: "text-[#fca5a5]" }, // red
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function siteColor(key: string) {
  return PALETTE[hash(key) % PALETTE.length];
}

export function SiteChip({
  name,
  domain,
  colorKey,
}: {
  name?: string | null;
  domain?: string | null;
  colorKey?: string | null;
}) {
  const label = name || domain || "—";
  const c = siteColor(colorKey || domain || label);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded ${c.bg} ${c.fg} max-w-[200px]`}
      title={domain || undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
