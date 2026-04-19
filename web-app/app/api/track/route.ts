import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS: beacon fires from the client site domain, dashboard runs on a
// different domain. Allow any origin — the api_key restricts writes to
// configured sites, and the endpoint is insert-only (no reads).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Body = {
  key?: string;
  path?: string;
  referrer?: string;
};

export async function POST(req: NextRequest) {
  // Accept text/plain too — navigator.sendBeacon defaults to that MIME
  // type and sending application/json would trigger a CORS preflight.
  let body: Body = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // Ignore parse errors — just skip the beacon.
    return new Response(null, { status: 204, headers: CORS });
  }

  const apiKey = req.headers.get("x-api-key") || body.key;
  if (!apiKey) return new Response(null, { status: 401, headers: CORS });

  const db = supabaseAdmin();
  const { data: site } = await db
    .from("sites")
    .select("id")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!site) return new Response(null, { status: 401, headers: CORS });

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";
  const ua = req.headers.get("user-agent") || "";
  const day = new Date().toISOString().slice(0, 10);
  const sessionHash = createHash("sha256")
    .update(`${ip}|${ua}|${site.id}|${day}`)
    .digest("hex");

  const path = typeof body.path === "string" ? body.path.slice(0, 500) : "/";
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

  // Insert is non-critical — swallow errors so a flaky DB can't cascade
  // into broken page renders on every client site.
  await db
    .from("page_views")
    .insert({ site_id: site.id, session_hash: sessionHash, path, referrer, day })
    .then(({ error }) => {
      if (error) console.error("[track] insert failed", error.message);
    });

  return new Response(null, { status: 204, headers: CORS });
}
