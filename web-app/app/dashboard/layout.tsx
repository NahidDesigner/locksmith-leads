import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { FailureBanner } from "@/components/FailureBanner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  requireSession();

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen">
      <aside className="border-r border-border bg-surface p-4 space-y-1">
        <div className="pb-4 mb-2 border-b border-border">
          <div className="text-sm font-semibold">Locksmith</div>
          <div className="text-xs text-muted">Leads dashboard</div>
        </div>
        <NavLink href="/dashboard" label="Overview" />
        <NavLink href="/dashboard/submissions" label="Submissions" />
        <NavLink href="/dashboard/sites" label="Sites" />
        <form action="/api/auth/logout" method="post" className="pt-6">
          <button className="text-xs text-muted hover:text-slate-200">Sign out</button>
        </form>
      </aside>
      <main className="p-6 max-w-7xl w-full space-y-4">
        <FailureBanner />
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block text-sm px-3 py-2 rounded hover:bg-bg text-slate-200"
    >
      {label}
    </Link>
  );
}
