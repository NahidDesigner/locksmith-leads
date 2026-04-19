import { cn } from "@/lib/utils";

export function HealthBadge({ lastHeartbeatAt }: { lastHeartbeatAt: string | null }) {
  if (!lastHeartbeatAt) {
    return <span className="text-xs px-2 py-0.5 rounded bg-bad/20 text-bad">no ping</span>;
  }
  const ms = Date.now() - new Date(lastHeartbeatAt).getTime();
  const mins = ms / 60000;
  const tone =
    mins <= 10 ? "bg-good/20 text-good" :
    mins <= 30 ? "bg-warn/20 text-warn" :
                 "bg-bad/20 text-bad";
  const label =
    mins <= 10 ? "healthy" :
    mins <= 30 ? "stale" :
                 "offline";
  return <span className={cn("text-xs px-2 py-0.5 rounded", tone)}>{label}</span>;
}
