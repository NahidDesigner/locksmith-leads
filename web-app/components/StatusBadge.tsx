import { cn } from "@/lib/utils";

type Status = "success" | "failed" | "pending" | "spam" | "unknown";

const TONE: Record<Status, string> = {
  success: "bg-good/20 text-good",
  failed:  "bg-bad/20 text-bad",
  pending: "bg-warn/20 text-warn",
  spam:    "bg-bad/20 text-bad",
  unknown: "bg-muted/20 text-muted",
};

const LABEL: Record<Status, string> = {
  success: "success",
  failed:  "failed",
  pending: "pending",
  spam:    "spam",
  unknown: "unknown",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s: Status = (status && (status in TONE) ? status : "unknown") as Status;
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", TONE[s])}>
      {LABEL[s]}
    </span>
  );
}
