import { supabaseAdmin, type SiteRow } from "@/lib/supabase";
import { SitesManager } from "./SitesManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SitesPage() {
  const { data } = await supabaseAdmin().from("sites").select("*").order("created_at", { ascending: false });
  return <SitesManager initialSites={(data ?? []) as SiteRow[]} />;
}
