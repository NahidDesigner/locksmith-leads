=== Leads Sync ===
Contributors: locksmithsites
Tags: elementor, forms, leads, dashboard, analytics
Requires at least: 6.0
Requires PHP: 7.4
Tested up to: 6.6
Stable tag: 1.0.0
License: GPLv2 or later

Pushes Elementor Pro form submissions to a central Locksmith Sites dashboard in real time.

== Description ==

Companion plugin for the Locksmith Sites central leads dashboard. Installs on every WordPress site whose Elementor form submissions you want aggregated.

Features:

* Real-time submission push on `elementor_pro/forms/new_record` — bypasses Cloudflare and page cache (it's a server-side PHP hook).
* Historical backfill — batched upload of every row in `wp_e_submissions`, idempotent (re-runnable).
* 5-minute heartbeat — lets the dashboard show health without waiting for the next lead.
* Admin UI — dashboard URL, API key, test connection, backfill progress.

== Installation ==

1. Upload the `leads-sync` folder to `/wp-content/plugins/`.
2. Activate through Plugins.
3. Settings → Leads Sync → paste dashboard URL + API key (get these from the dashboard's Sites screen).
4. Click "Send test heartbeat" to verify connectivity.
5. Click "Sync Historical Now" to backfill existing submissions.

== Requirements ==

* Elementor Pro 3.5+ (uses the `wp_e_submissions` table for backfill).
* Outbound HTTPS allowed from the WP server to the dashboard.

== Cache notes ==

If your host or CDN caches everything aggressively, exclude these from cache:

* `/wp-admin/admin-ajax.php`
* `/wp-cron.php`
* Anything posting JSON to your dashboard URL

The submission hook itself runs server-side during form processing and is unaffected by page cache.
