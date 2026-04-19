"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Login failed");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Locksmith Dashboard</h1>
          <p className="text-sm text-muted">Sign in to continue</p>
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-bg border border-border rounded px-3 py-2"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-bg border border-border rounded px-3 py-2"
            required
          />
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
