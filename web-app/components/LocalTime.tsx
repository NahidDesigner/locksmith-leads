"use client";
import { useEffect, useState } from "react";

type Mode = "absolute" | "relative" | "both";

type Props = {
  iso: string | null | undefined;
  mode?: Mode;
  className?: string;
  subClassName?: string;
};

// Any timestamp this old is treated as invalid (epoch-0 garbage from
// Elementor rows with `0000-00-00 00:00:00` — mysql_to_rfc3339 turns
// those into 1970-01-01). Rendering them as "55y ago" is worse than "—".
const MIN_VALID_MS = Date.UTC(2000, 0, 1);

function isBad(iso: string | null | undefined): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) || t < MIN_VALID_MS;
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function LocalTime({ iso, mode = "both", className, subClassName }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isBad(iso)) {
    return <span className={className}>—</span>;
  }

  // SSR + first client render: stable ISO slice to avoid hydration mismatch.
  // Replaced with user-locale formatting once mounted.
  const fallback = iso!.slice(0, 16).replace("T", " ");

  const abs = mounted
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso!))
    : fallback;

  const rel = mounted ? relative(iso!) : "";

  if (mode === "absolute") return <span className={className} title={iso!}>{abs}</span>;
  if (mode === "relative") return <span className={className} title={abs}>{rel || fallback}</span>;

  return (
    <span className={className} title={iso!}>
      <span>{rel || fallback}</span>
      <span className={subClassName ?? "block text-xs text-muted"}>{abs}</span>
    </span>
  );
}
