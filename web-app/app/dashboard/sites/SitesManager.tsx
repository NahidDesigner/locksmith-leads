"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteRow } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";
import { HealthBadge } from "@/components/HealthBadge";

export function SitesManager({ initialSites }: { initialSites: SiteRow[] }) {
  const router = useRouter();
  const [sites, setSites] = useState(initialSites);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [form, setForm] = useState({ domain: "", display_name: "", timezone: "UTC" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Failed to add site");
      return;
    }
    const { site } = await res.json();
    setSites((cur) => [site, ...cur]);
    setShowKey(site.id);
    setForm({ domain: "", display_name: "", timezone: "UTC" });
  }

  async function rotateKey(id: string) {
    if (!confirm("Rotate API key? The old key stops working immediately — update the plugin on that site.")) return;
    const res = await fetch(`/api/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate_key: true }),
    });
    if (!res.ok) { alert("Failed to rotate"); return; }
    const { site } = await res.json();
    setSites((cur) => cur.map((s) => (s.id === id ? site : s)));
    setShowKey(id);
  }

  async function toggleActive(s: SiteRow) {
    const res = await fetch(`/api/sites/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    if (!res.ok) return;
    const { site } = await res.json();
    setSites((cur) => cur.map((x) => (x.id === s.id ? site : x)));
  }

  async function removeSite(s: SiteRow) {
    if (!confirm(`Delete "${s.display_name}" and all its ${"\n"}submissions from the dashboard? This cannot be undone.`)) return;
    const res = await fetch(`/api/sites/${s.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setSites((cur) => cur.filter((x) => x.id !== s.id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sites</h1>

      <section className="bg-surface border border-border rounded-lg p-4">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3">Add a site</h2>
        <form onSubmit={addSite} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-3">
          <input
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            placeholder="example.com"
            required
            className="bg-bg border border-border rounded px-3 py-2 text-sm"
          />
          <input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="Display name"
            required
            className="bg-bg border border-border rounded px-3 py-2 text-sm"
          />
          <input
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            placeholder="UTC"
            className="bg-bg border border-border rounded px-3 py-2 text-sm"
          />
          <button disabled={busy} className="bg-accent text-white rounded px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "Adding…" : "Add site"}
          </button>
        </form>
        {error && <p className="text-sm text-bad mt-2">{error}</p>}
      </section>

      <section className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-xs uppercase text-muted">
            <tr>
              <th className="text-left px-4 py-2">Site</th>
              <th className="text-left px-4 py-2">Health</th>
              <th className="text-left px-4 py-2">Last lead</th>
              <th className="text-left px-4 py-2">API key</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.display_name}</div>
                  <div className="text-xs text-muted">{s.domain}</div>
                  {!s.is_active && <div className="text-xs text-warn mt-1">inactive</div>}
                </td>
                <td className="px-4 py-3"><HealthBadge lastHeartbeatAt={s.last_heartbeat_at} /></td>
                <td className="px-4 py-3 text-muted">{formatRelative(s.last_submission_at)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {showKey === s.id ? (
                    <div>
                      <div className="break-all">{s.api_key}</div>
                      <button onClick={() => setShowKey(null)} className="text-muted hover:text-slate-200 mt-1">hide</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowKey(s.id)} className="text-accent hover:underline">show</button>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => rotateKey(s.id)} className="text-xs text-warn hover:underline">Rotate key</button>
                  <button onClick={() => toggleActive(s)} className="text-xs text-muted hover:text-slate-200">{s.is_active ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => removeSite(s)} className="text-xs text-bad hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No sites yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
