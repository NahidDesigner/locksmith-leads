import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateApiKey } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!getSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin()
    .from("sites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sites: data });
}

export async function POST(req: NextRequest) {
  if (!getSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const domain = String(body.domain || "").trim().toLowerCase();
  const display_name = String(body.display_name || "").trim();
  const timezone = String(body.timezone || "UTC").trim();

  if (!domain || !display_name) {
    return NextResponse.json({ error: "domain and display_name required" }, { status: 400 });
  }

  const api_key = generateApiKey();

  const { data, error } = await supabaseAdmin()
    .from("sites")
    .insert({ domain, display_name, api_key, timezone })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}
