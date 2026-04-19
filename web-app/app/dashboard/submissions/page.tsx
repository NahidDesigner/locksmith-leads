import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { LocalTime } from "@/components/LocalTime";
import { SiteChip } from "@/components/SiteChip";

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

const PREVIEW_LIMIT = 5;

// Elementor auto-generates field IDs like `field_4c0a481` when the user
// doesn't rename them, so we can't rely on key names alone. Detect by
// value first (email / phone) and fall back to key hints for everything
// else. Display label comes from the schema-ish hints when possible.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;

const KEY_HINTS: Array<[RegExp, string]> = [
  [/^(name|full[_-]?name|first[_-]?name|your[_-]?name)$/i, "name"],
  [/^(email|your[_-]?email|e[_-]?mail)$/i, "email"],
  [/^(phone|your[_-]?phone|mobile|number|contact|tel)$/i, "phone"],
  [/^(service|subject)$/i, "service"],
  [/^(message|your[_-]?message|comments?|enquiry|inquiry)$/i, "message"],
  [/^(address|location|city|postcode|zip)$/i, "address"],
];

// Priority → lower number wins. Email is most useful, then name/phone,
// then context (service/subject), then message, then everything else.
const CATEGORY_PRIORITY: Record<string, number> = {
  email: 1,
  name: 2,
  phone: 3,
  service: 4,
  address: 5,
  message: 6,
  other: 99,
};

function categorize(key: string, raw: unknown): { label: string; text: string; rank: number } | null {
  const text = typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  if (!text.trim()) return null;

  const trimmed = text.trim();

  // 1. Value-based detection — wins over key name because Elementor
  //    generated IDs don't encode field meaning.
  if (EMAIL_RE.test(trimmed)) {
    return { label: "email", text: trimmed, rank: CATEGORY_PRIORITY.email };
  }
  if (PHONE_RE.test(trimmed) && /\d/.test(trimmed)) {
    // Extra guard: value must have ≥6 digits, else it's noise.
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 6) {
      return { label: "phone", text: trimmed, rank: CATEGORY_PRIORITY.phone };
    }
  }

  // 2. Key-name hints for non-distinctive values.
  for (const [re, cat] of KEY_HINTS) {
    if (re.test(key)) {
      return { label: cat, text: trimmed, rank: CATEGORY_PRIORITY[cat] };
    }
  }

  return { label: key, text: trimmed, rank: CATEGORY_PRIORITY.other };
}

function pickPreview(data: Record<string, unknown>) {
  const scored: Array<{ key: string; label: string; text: string; rank: number }> = [];
  for (const [k, v] of Object.entries(data ?? {})) {
    const c = categorize(k, v);
    if (c) scored.push({ key: k, ...c });
  }
  // Stable sort: by rank asc, then original insertion order.
  scored.sort((a, b) => a.rank - b.rank);
  const top = scored.slice(0, PREVIEW_LIMIT);
  const topKeys = new Set(top.map((t) => t.key));
  const rest = Object.entries(data ?? {}).filter(([k]) => !topKeys.has(k));
  return { top, rest };
}

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
    if (searchParams.status)  u.set("status", searchParams.status);
    if (searchParams.from)    u.set("from", searchParams.from);
    if (searchParams.to)      u.set("to", searchParams.to);
    if (searchParams.q)       u.set("q", searchParams.q);
    return `/api/export?${u.toString()}`;
  })();

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasFilters = Boolean(
    searchParams.site_id || searchParams.form_id || searchParams.status ||
    searchParams.from || searchParams.to || searchParams.q
  );

  const activeSite = sites?.find((s) => s.id === searchParams.site_id);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Submissions</h1>
          <div className="text-sm text-muted mt-1">
            {total.toLocaleString()} total
            {activeSite && <> · filtered to <span className="text-fg">{activeSite.display_name}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Link
              href="/dashboard/submissions"
              className="text-sm border border-border rounded px-3 py-1.5 hover:bg-bg"
            >
              Clear filters
            </Link>
          )}
          <a href={exportUrl} className="text-sm bg-accent text-white px-3 py-1.5 rounded">
            Export CSV
          </a>
        </div>
      </header>

      <form className="bg-surface border border-border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3" method="get">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-[11px] uppercase tracking-wider text-muted">Site</span>
          <select name="site_id" defaultValue={searchParams.site_id ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm">
            <option value="">All sites</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.display_name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">Status</span>
          <select name="status" defaultValue={searchParams.status ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">From</span>
          <input name="from" type="date" defaultValue={searchParams.from ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">To</span>
          <input name="to" type="date" defaultValue={searchParams.to ?? ""} className="bg-bg border border-border rounded px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-5">
          <span className="text-[11px] uppercase tracking-wider text-muted">Search</span>
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search name, email, message…" className="bg-bg border border-border rounded px-3 py-2 text-sm" />
        </label>
        <div className="flex items-end">
          <button className="w-full bg-accent text-white rounded py-2 text-sm">Apply</button>
        </div>
      </form>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-xs uppercase text-muted">
            <tr>
              <th className="text-left px-4 py-2 w-[140px]">When</th>
              <th className="text-left px-4 py-2 w-[180px]">Site</th>
              <th className="text-left px-4 py-2 w-[140px]">Form</th>
              <th className="text-left px-4 py-2">Preview</th>
              <th className="text-left px-4 py-2 w-[110px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              const { top, rest } = pickPreview(r.data ?? {});
              return (
                <tr key={r.id} className="border-t border-border align-top hover:bg-bg/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LocalTime iso={r.submitted_at} />
                  </td>
                  <td className="px-4 py-3">
                    <SiteChip
                      name={r.sites?.display_name}
                      domain={r.sites?.domain}
                      colorKey={r.sites?.domain ?? r.sites?.display_name}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs">{r.forms?.form_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {top.map((t) => (
                        <div key={t.key} className="text-xs truncate max-w-md">
                          <span className="text-muted">{t.label}:</span>{" "}
                          <span>{t.text}</span>
                        </div>
                      ))}
                      {top.length === 0 && <span className="text-xs text-muted italic">(no data)</span>}
                      {rest.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-muted cursor-pointer hover:text-accent">
                            +{rest.length} more field{rest.length === 1 ? "" : "s"}
                          </summary>
                          <div className="mt-1 pl-2 border-l border-border space-y-0.5">
                            {rest.map(([k, v]) => (
                              <div key={k} className="text-xs">
                                <span className="text-muted">{k}:</span>{" "}
                                <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                              </div>
                            ))}
                            {r.ip && <div className="text-xs text-muted pt-1 font-mono">IP: {r.ip}</div>}
                          </div>
                        </details>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No submissions match these filters.</td></tr>
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
