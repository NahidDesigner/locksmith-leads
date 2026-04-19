import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Papa from "papaparse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const siteId = url.searchParams.get("site_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const formId = url.searchParams.get("form_id");

  let q = supabaseAdmin()
    .from("submissions")
    .select("submitted_at, data, ip, user_agent, referrer, utm, source, sites(domain, display_name), forms(form_name, elementor_form_id)")
    .order("submitted_at", { ascending: false })
    .limit(50000);

  if (siteId) q = q.eq("site_id", siteId);
  if (formId) q = q.eq("form_id", formId);
  if (from) q = q.gte("submitted_at", from);
  if (to) q = q.lte("submitted_at", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => {
    const flat: Record<string, unknown> = {
      submitted_at: r.submitted_at,
      site: r.sites?.display_name ?? "",
      domain: r.sites?.domain ?? "",
      form: r.forms?.form_name ?? "",
      ip: r.ip ?? "",
      referrer: r.referrer ?? "",
      user_agent: r.user_agent ?? "",
      source: r.source,
    };
    // Flatten submission data as data.<key>
    for (const [k, v] of Object.entries(r.data ?? {})) {
      flat[`data.${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    }
    return flat;
  });

  const csv = Papa.unparse(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="submissions-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
