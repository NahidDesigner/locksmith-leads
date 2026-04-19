import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Banner shown in the dashboard header when there are failed submissions
 * in the last 24h. Links through to the pre-filtered submissions view.
 * Server-rendered — no client JS needed.
 */
export async function FailureBanner() {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { count, error } = await db
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("submitted_at", since);

  if (error || !count) return null;

  return (
    <Link
      href="/dashboard/submissions?status=failed"
      className="block bg-bad/15 border border-bad/40 text-bad rounded-lg px-4 py-3 text-sm hover:bg-bad/20"
    >
      <span aria-hidden className="mr-2">⚠</span>
      <strong>{count} failed submission{count === 1 ? "" : "s"}</strong> in the last 24 hours.
      <span className="text-bad/80 ml-2">Click to review →</span>
    </Link>
  );
}
