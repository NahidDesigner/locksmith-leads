import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatRelative(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function generateApiKey() {
  // 40 url-safe chars
  return "ls_" + Array.from(crypto.getRandomValues(new Uint8Array(30)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function percentChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}
