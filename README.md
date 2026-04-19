# Locksmith Sites — Centralized Leads Dashboard

Unified dashboard aggregating Elementor Pro form submissions from multiple WordPress sites, with real-time ingest, historical backfill, site health monitoring, and submission-drop alerts.

## Project layout

```
locksmithsites/
├── web-app/        Next.js 14 dashboard (deploy to Vercel)
├── wp-plugin/      WordPress plugin (install on each client site)
│   └── leads-sync/
└── supabase/       Postgres schema + migrations
```

## How it works

```
[WP sites] --(plugin)--> [Next.js /api/ingest + /api/heartbeat] --> [Supabase]
                                                                         |
                                         [Admin UI on Vercel] <----------+
```

- Plugin's PHP hook on `elementor_pro/forms/new_record` pushes each new lead in real time. Server-side — bypasses Cloudflare and all page cache.
- Plugin's "Sync Historical" admin button bulk-uploads every row in `wp_e_submissions` (idempotent via `external_id`).
- Plugin pings `/api/heartbeat` every 5 min with WP/Elementor versions + active form count + last submission time → site health.
- Dashboard computes trend/drop analytics from Supabase.

## Setup order

1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Deploy `web-app/` to Vercel with env vars (see `web-app/.env.example`). Root directory must be `web-app/`.
3. Add each site in the dashboard → copy generated API key.
4. Install `wp-plugin/leads-sync/` on each WP site, paste API key + dashboard URL.
5. Hit "Sync Historical" once per site to backfill.

## Phase 1 scope

- Multi-site ingest (real-time + historical backfill)
- Submissions list: filter by site/form/date, full-text search, CSV export
- Overview: total leads, today/7d/30d, per-site breakdown, trend chart
- Drop detection (site flagged if last-7d count < 70% of prior 7d)
- Site health via plugin heartbeat

## Phase 2 (later)

- External synthetic checks (fetch form page, validate nonce/JS)
- Email/Slack alerts on drops or missing heartbeats
- UTM attribution, spam scoring, duplicate detection
