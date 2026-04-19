import { NextRequest, NextResponse } from "next/server";
import { authenticateSite } from "@/lib/plugin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const site = await authenticateSite(req);
  if (!site) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  await db.from("heartbeats").insert({
    site_id: site.id,
    wp_version: body.wp_version ?? null,
    php_version: body.php_version ?? null,
    elementor_version: body.elementor_version ?? null,
    elementor_pro_version: body.elementor_pro_version ?? null,
    plugin_version: body.plugin_version ?? null,
    active_forms_count: body.active_forms_count ?? null,
    last_submission_at: body.last_submission_at ?? null,
    php_errors_count: body.php_errors_count ?? 0,
    meta: body.meta ?? {},
  });

  await db.from("sites").update({ last_heartbeat_at: now }).eq("id", site.id);

  return NextResponse.json({ ok: true });
}
