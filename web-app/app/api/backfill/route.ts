import { NextRequest, NextResponse } from "next/server";
import { authenticateSite } from "@/lib/plugin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = {
  external_id: number;
  elementor_form_id: string;
  form_name: string;
  submitted_at: string;
  data: Record<string, unknown>;
  ip?: string | null;
  user_agent?: string;
  referrer?: string;
  status?: "success" | "failed";
};

const ALLOWED_STATUS = new Set(["success", "failed"]);

export async function POST(req: NextRequest) {
  const site = await authenticateSite(req);
  if (!site) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { submissions: Row[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rows = Array.isArray(body?.submissions) ? body.submissions : [];
  if (rows.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const db = supabaseAdmin();

  // Upsert distinct forms first so we can map elementor_form_id → form.id
  const byForm = new Map<string, { elementor_form_id: string; form_name: string }>();
  for (const r of rows) {
    byForm.set(r.elementor_form_id, { elementor_form_id: r.elementor_form_id, form_name: r.form_name });
  }

  const formUpserts = Array.from(byForm.values()).map((f) => ({
    site_id: site.id,
    elementor_form_id: f.elementor_form_id,
    form_name: f.form_name,
  }));

  const { error: formsErr } = await db
    .from("forms")
    .upsert(formUpserts, { onConflict: "site_id,elementor_form_id" });
  if (formsErr) {
    return NextResponse.json({ error: "forms_upsert_failed", detail: formsErr.message }, { status: 500 });
  }

  const { data: formRows, error: formsSelErr } = await db
    .from("forms")
    .select("id, elementor_form_id")
    .eq("site_id", site.id)
    .in("elementor_form_id", Array.from(byForm.keys()));

  if (formsSelErr || !formRows) {
    return NextResponse.json({ error: "forms_select_failed", detail: formsSelErr?.message }, { status: 500 });
  }

  const formIdMap = new Map<string, string>();
  for (const f of formRows) formIdMap.set(f.elementor_form_id, f.id);

  const inserts = rows.map((r) => ({
    site_id: site.id,
    form_id: formIdMap.get(r.elementor_form_id)!,
    external_id: r.external_id,
    submitted_at: r.submitted_at,
    data: r.data ?? {},
    ip: r.ip ?? null,
    user_agent: r.user_agent ?? null,
    referrer: r.referrer ?? null,
    utm: {},
    source: "backfill" as const,
    status: ALLOWED_STATUS.has(r.status ?? "") ? r.status : "success",
  }));

  // Not ignoreDuplicates — on re-sync we want Elementor's current status
  // (e.g. a previously 'pending' row may now be 'success' or 'failed') to win.
  const { error: subErr, count } = await db
    .from("submissions")
    .upsert(inserts, { onConflict: "site_id,external_id", count: "exact" });

  if (subErr) {
    return NextResponse.json({ error: "submissions_upsert_failed", detail: subErr.message }, { status: 500 });
  }

  // Refresh denormalized last_submission_at
  const latest = rows.reduce((max, r) => (r.submitted_at > max ? r.submitted_at : max), "1970-01-01");
  await db.from("sites").update({ last_submission_at: latest }).eq("id", site.id);

  return NextResponse.json({ ok: true, received: rows.length, inserted: count ?? null });
}
