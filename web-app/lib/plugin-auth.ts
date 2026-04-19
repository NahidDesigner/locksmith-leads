import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";
import type { SiteRow } from "./supabase";

/**
 * Validates the `X-Api-Key` header against the `sites` table.
 * Returns the matching site, or null if invalid.
 */
export async function authenticateSite(req: NextRequest): Promise<SiteRow | null> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const { data, error } = await supabaseAdmin()
    .from("sites")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as SiteRow;
}
