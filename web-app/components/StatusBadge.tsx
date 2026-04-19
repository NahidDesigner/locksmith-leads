import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status?: string | null }) {
  const failed = status === "failed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium",
        failed ? "bg-bad/20 text-bad" : "bg-good/20 text-good"
      )}
      title={failed ? "At least one form action failed" : "All form actions succeeded"}
    >
      <span aria-hidden>{failed ? "⚠" : "✓"}</span>
      {failed ? "failed" : "success"}
    </span>
  );
}
