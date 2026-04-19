import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { formatRelative } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  site_id?: string;
  form_id?: string;
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: string;
};

const PAGE_SIZE = 50;

export default async function SubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const db = supabaseAdmin();
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const { data: sites } = await db.from("sites").select("id, domain, display_name").order("display_name");

  let q = db
    .from("submissions")
    .select("id, submitted_at, data, ip, referrer, source, status, sites(domain, display_name), forms(form_name, elementor_form_id)", { count: "exact" })
    .order("submitted_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (searchParams.site_id) q = q.eq("site_id", searchParams.site_id);
  if (searchParams.form_id) q = q.eq("form_id", searchParams.form_id);
  if (searchParams.status)  q = q.eq("status", searchParams.status);
  if (searchParams.from)    q = q.gte("submitted_at", searchParams.from);
  if (searchParams.to)      q = q.lte("submitted_at", searchParams.to);
  if (searchParams.q)       q = q.textSearch("data_tsv", searchParams.q, { type: "websearch" });

  const { data: rows, count } = await q;

  const exportUrl = (() => {
    const u = new URLSearchParams();
    if (searchParams.site_id) u.set("site_id", searchParams.site_id);
    if (searchParams.form_id) u.set("form_id", searchParams.form_id);
    if (searchParams.from) u.set("from", searchParams.from);
    if (searchParams.to) u.set("to", searchParams.to);
    return `/api/export?${u.toString()}`;
  })();

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Submissions</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{total.toLocaleString()} total</span>
          <a href={exportUrl} className="text-sm bg-accent text-white px-3 py-1.5 rounded">Export CSV</a>
        </div>
      </header>

      <form className="bg-surface border border-border rounded-lg p-4 grid grid-cols-2 md:grid-cols-6 gap-3" method="get">
        <select name="site_id" defaultValue={searchParams.site_id ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm">
          <option value="">All sites</option>
          {(sites ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.display_name}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm">
          <option value="">Any status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="spam">Spam</option>
        </select>
        <input name="from" type="date" defaultValue={searchParams.from ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm" />
        <input name="to" type="date" defaultValue={searchParams.to ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm" />
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search data…" className="bg-bg border border-border rounded px-3 py-2 text-sm col-span-2 md:col-span-1" />
        <button className="bg-accent text-white rounded py-2 text-sm">Apply</button>
      </form>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-xs uppercase text-muted">
            <tr>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">When</th>
              <th className="text-left px-4 py-2">Site</th>
              <th className="text-left px-4 py-2">Form</th>
              <th className="text-left px-4 py-2">Data</th>
              <th className="text-left px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-border align-top hover:bg-bg/40">
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>{formatRelative(r.submitted_at)}</div>
                  <div className="text-xs text-muted">{new Date(r.submitted_at).toLocaleString()}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.sites?.display_name ?? "—"}</div>
                  <div className="text-xs text-muted">{r.sites?.domain}</div>
                </td>
                <td className="px-4 py-3">{r.forms?.form_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {Object.entries(r.data ?? {}).slice(0, 6).map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="text-muted">{k}:</span>{" "}
                        <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted font-mono">{r.ip ?? ""}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No submissions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="px-3 py-1 bg-surface border border-border rounded" href={buildPageHref(searchParams, page - 1)}>Prev</Link>
            )}
            {page < totalPages && (
              <Link className="px-3 py-1 bg-surface border border-border rounded" href={buildPageHref(searchParams, page + 1)}>Next</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildPageHref(params: SearchParams, page: number) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v && k !== "page") u.set(k, String(v)); });
  u.set("page", String(page));
  return `?${u.toString()}`;
}
