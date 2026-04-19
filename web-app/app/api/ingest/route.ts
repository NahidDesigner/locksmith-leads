import { NextRequest, NextResponse } from "next/server";
import { authenticateSite } from "@/lib/plugin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  form: {
    elementor_form_id: string;
    form_name: string;
    page_url?: string;
    field_schema?: Array<{ id: string; label: string; type: string }>;
  };
  submission: {
    submitted_at: string;
    data: Record<string, unknown>;
    ip?: string | null;
    user_agent?: string;
    referrer?: string;
    utm?: Record<string, string>;
    source?: "realtime" | "backfill" | "manual";
    status?: "success" | "failed" | "pending" | "spam" | "unknown";
    external_id?: number | null;
  };
};

const ALLOWED_STATUS = new Set(["success", "failed", "pending", "spam", "unknown"]);

export async function POST(req: NextRequest) {
  const site = await authenticateSite(req);
  if (!site) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body?.form?.elementor_form_id || !body?.submission?.submitted_at) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Upsert form (site_id + elementor_form_id is the natural key)
  const { data: form, error: formErr } = await db
    .from("forms")
    .upsert(
      {
        site_id: site.id,
        elementor_form_id: body.form.elementor_form_id,
        form_name: body.form.form_name,
        page_url: body.form.page_url ?? null,
        field_schema: body.form.field_schema ?? [],
      },
      { onConflict: "site_id,elementor_form_id" }
    )
    .select("id")
    .single();

  if (formErr || !form) {
    return NextResponse.json({ error: "form_upsert_failed", detail: formErr?.message }, { status: 500 });
  }

  // Insert submission (dedupe on site+external_id if present)
  const insert = {
    site_id: site.id,
    form_id: form.id,
    external_id: body.submission.external_id ?? null,
    submitted_at: body.submission.submitted_at,
    data: body.submission.data ?? {},
    ip: body.submission.ip ?? null,
    user_agent: body.submission.user_agent ?? null,
    referrer: body.submission.referrer ?? null,
    utm: body.submission.utm ?? {},
    source: body.submission.source ?? "realtime",
    status: ALLOWED_STATUS.has(body.submission.status ?? "")
      ? body.submission.status
      : "success",
  };

  const { error: subErr } = body.submission.external_id
    ? await db.from("submissions").upsert(insert, { onConflict: "site_id,external_id", ignoreDuplicates: true })
    : await db.from("submissions").insert(insert);

  if (subErr) {
    return NextResponse.json({ error: "submission_insert_failed", detail: subErr.message }, { status: 500 });
  }

  // Update denormalized last_submission_at fields (best-effort, non-fatal)
  await Promise.all([
    db.from("sites").update({ last_submission_at: body.submission.submitted_at }).eq("id", site.id),
    db.from("forms").update({ last_submission_at: body.submission.submitted_at }).eq("id", form.id),
  ]);

  return NextResponse.json({ ok: true });
}
