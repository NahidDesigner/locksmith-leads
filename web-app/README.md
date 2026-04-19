# Locksmith Dashboard (web-app)

Next.js 14 + Supabase. Deploys to Vercel.

## One-time setup

### 1. Create a Supabase project
- [supabase.com](https://supabase.com) → New project → copy **URL**, **anon key**, **service role key**.
- Open **SQL Editor** → paste `../supabase/schema.sql` → Run.

### 2. Local dev
```bash
cp .env.example .env.local
# fill in Supabase keys + pick an email & password

# generate ADMIN_PASSWORD_HASH
npm install
npm run dev
# now open http://localhost:3000/api/hash?password=YOUR_PASSWORD
# paste the returned hash into .env.local as ADMIN_PASSWORD_HASH
# generate SESSION_SECRET: run `openssl rand -base64 48` (or any 48+ random chars)

# restart
npm run dev
```

Visit http://localhost:3000 → log in.

### 3. Deploy to Vercel
- Import the `web-app/` folder as a new Vercel project.
- Add these env vars in Vercel → Settings → Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD_HASH`
  - `SESSION_SECRET`
- Deploy. Note the deployed URL — it's what you'll paste into each WP site's plugin settings.

## Add a site
1. Dashboard → **Sites** → Add site (domain + display name).
2. Click **show** on the new row → copy the API key.
3. On that WP site: install `wp-plugin/leads-sync/`, go to **Settings → Leads Sync**, paste the dashboard URL and API key, click **Send test heartbeat** to confirm.
4. Click **Sync Historical Now** to backfill every existing submission (batched; safe to re-run, deduped).

## Architecture notes

- **Auth:** single admin. `SESSION_SECRET`-signed HMAC cookie, 14-day TTL.
- **Plugin → dashboard:** `X-Api-Key` header matched against `sites.api_key`. Service role bypasses RLS inside Next.js API routes.
- **RLS:** all tables have RLS enabled with no public policies — reads only work via the service role key.
- **Idempotency:** backfill inserts dedupe on `(site_id, external_id)` so you can re-run freely.
- **Cache immunity:** the plugin's `elementor_pro/forms/new_record` hook runs server-side in PHP, past Cloudflare and any page cache. Heartbeat + backfill also run server-side.

## Routes

### Plugin-facing (auth: `X-Api-Key`)
- `POST /api/ingest`    — single real-time submission
- `POST /api/backfill`  — batch of historical submissions
- `POST /api/heartbeat` — 5-min health ping

### Dashboard (auth: admin session cookie)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/sites` / `POST /api/sites`
- `PATCH /api/sites/[id]` / `DELETE /api/sites/[id]`
- `GET  /api/export?site_id=…&from=…&to=…`

### Dev-only
- `GET /api/hash?password=…` → scrypt hash for `ADMIN_PASSWORD_HASH` (404 in production).
