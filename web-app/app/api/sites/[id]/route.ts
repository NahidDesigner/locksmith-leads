import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateApiKey } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.display_name === "string") patch.display_name = body.display_name.trim();
  if (typeof body.timezone === "string") patch.timezone = body.timezone.trim();
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (body.rotate_key === true) patch.api_key = generateApiKey();

  const { data, error } = await supabaseAdmin()
    .from("sites")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!getSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await supabaseAdmin().from("sites").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
