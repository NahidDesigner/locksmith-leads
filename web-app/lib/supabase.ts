import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Server-side Supabase client using the service role key.
 * Bypasses RLS — only import from server components and API routes.
 */
export function supabaseAdmin() {
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars (URL / service role key).");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SubmissionRow = {
  id: string;
  site_id: string;
  form_id: string;
  external_id: number | null;
  submitted_at: string;
  data: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  referrer: string | null;
  utm: Record<string, string>;
  received_at: string;
  source: "realtime" | "backfill" | "manual";
};

export type SiteRow = {
  id: string;
  domain: string;
  display_name: string;
  api_key: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  last_heartbeat_at: string | null;
  last_submission_at: string | null;
  notes: string | null;
};

export type SiteStatsRow = {
  site_id: string;
  domain: string;
  display_name: string;
  is_active: boolean;
  last_heartbeat_at: string | null;
  last_submission_at: string | null;
  total_submissions: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  prior_7d: number;
};
