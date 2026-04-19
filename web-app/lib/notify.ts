/**
 * Email notifications via Resend. Opt-in: if RESEND_API_KEY or
 * NOTIFY_EMAIL is missing, notifications are silently skipped — the
 * main flow never fails because of missing email config.
 *
 * Env vars:
 *   RESEND_API_KEY   — API key from resend.com
 *   NOTIFY_EMAIL     — recipient (admin) email
 *   NOTIFY_FROM      — optional sender; defaults to onboarding@resend.dev
 *                      (works without domain verification, Resend test only)
 */

type FailedSubmissionParams = {
  siteName: string;
  siteDomain: string;
  formName: string;
  submittedAt: string;
  data: Record<string, unknown>;
  dashboardUrl?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifyFailedSubmission(params: FailedSubmissionParams): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;

  const from = process.env.NOTIFY_FROM || "Leads Sync <onboarding@resend.dev>";
  const dataRows = Object.entries(params.data ?? {})
    .map(([k, v]) => {
      const val = typeof v === "string" ? v : JSON.stringify(v);
      return `<tr><td style="padding:4px 8px;color:#64748b;">${escapeHtml(k)}</td><td style="padding:4px 8px;">${escapeHtml(val)}</td></tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 8px;color:#dc2626;">⚠ Failed form submission</h2>
      <p style="margin:0 0 16px;color:#475569;">
        A submission on <strong>${escapeHtml(params.siteName)}</strong>
        (${escapeHtml(params.siteDomain)}) reported at least one failed form action
        (email, webhook, etc.).
      </p>
      <table style="border-collapse:collapse;width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;">
        <tr><td style="padding:4px 8px;color:#64748b;">Form</td><td style="padding:4px 8px;">${escapeHtml(params.formName)}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">When</td><td style="padding:4px 8px;">${escapeHtml(params.submittedAt)}</td></tr>
        ${dataRows}
      </table>
      ${params.dashboardUrl ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(params.dashboardUrl)}" style="color:#2563eb;">Open in dashboard →</a></p>` : ""}
    </div>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[Leads Sync] Failed submission on ${params.siteName}`,
        html,
      }),
    });
    if (!res.ok) {
      // Log but don't throw — notification failure must not break ingest.
      const body = await res.text().catch(() => "");
      console.error("[notify] Resend error", res.status, body);
    }
  } catch (err) {
    console.error("[notify] Resend request failed", err);
  }
}
