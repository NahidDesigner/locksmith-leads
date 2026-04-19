-- Locksmith Sites — Supabase schema
-- Run this in Supabase SQL Editor once per project.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================================================================
-- TABLES
-- ============================================================================

-- One row per WordPress site
create table if not exists sites (
  id                   uuid primary key default gen_random_uuid(),
  domain               text not null unique,
  display_name         text not null,
  api_key              text not null unique,
  timezone             text not null default 'UTC',
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  last_heartbeat_at    timestamptz,
  last_submission_at   timestamptz,
  notes                text
);

-- One row per Elementor form (per site)
create table if not exists forms (
  id                   uuid primary key default gen_random_uuid(),
  site_id              uuid not null references sites(id) on delete cascade,
  elementor_form_id    text not null,
  form_name            text not null,
  page_url             text,
  field_schema         jsonb not null default '[]'::jsonb,
  first_seen_at        timestamptz not null default now(),
  last_submission_at   timestamptz,
  unique (site_id, elementor_form_id)
);

-- One row per form submission (real-time push or backfill)
create table if not exists submissions (
  id                   uuid primary key default gen_random_uuid(),
  site_id              uuid not null references sites(id) on delete cascade,
  form_id              uuid not null references forms(id) on delete cascade,
  external_id          bigint,                         -- wp_e_submissions.id for idempotent backfill
  submitted_at         timestamptz not null,
  data                 jsonb not null default '{}'::jsonb,
  ip                   inet,
  user_agent           text,
  referrer             text,
  utm                  jsonb not null default '{}'::jsonb,
  received_at          timestamptz not null default now(),
  source               text not null default 'realtime' check (source in ('realtime','backfill','manual')),
  status               text not null default 'success' check (status in ('success','failed','pending','spam','unknown')),
  -- generated tsvector for full-text search across all submission values
  data_tsv             tsvector generated always as (to_tsvector('simple', coalesce(data::text, ''))) stored,
  unique (site_id, external_id)
);

-- One row per plugin heartbeat (health ping every ~5 min)
create table if not exists heartbeats (
  id                     bigserial primary key,
  site_id                uuid not null references sites(id) on delete cascade,
  received_at            timestamptz not null default now(),
  wp_version             text,
  php_version            text,
  elementor_version      text,
  elementor_pro_version  text,
  plugin_version         text,
  active_forms_count     int,
  last_submission_at     timestamptz,
  php_errors_count       int not null default 0,
  meta                   jsonb not null default '{}'::jsonb
);

-- Drop-detection alerts (populated by cron)
create table if not exists alerts (
  id                   bigserial primary key,
  site_id              uuid not null references sites(id) on delete cascade,
  kind                 text not null check (kind in ('submission_drop','no_heartbeat','form_missing')),
  severity             text not null default 'warning' check (severity in ('info','warning','critical')),
  message              text not null,
  details              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_submissions_site_submitted   on submissions (site_id, submitted_at desc);
create index if not exists idx_submissions_form_submitted   on submissions (form_id, submitted_at desc);
create index if not exists idx_submissions_submitted        on submissions (submitted_at desc);
create index if not exists idx_submissions_data_gin         on submissions using gin (data);
create index if not exists idx_submissions_data_tsv         on submissions using gin (data_tsv);
create index if not exists idx_submissions_site_status      on submissions (site_id, status);
create index if not exists idx_heartbeats_site_received     on heartbeats (site_id, received_at desc);
create index if not exists idx_alerts_site_created          on alerts (site_id, created_at desc);
create index if not exists idx_alerts_unresolved            on alerts (resolved_at) where resolved_at is null;

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
-- Strategy: API routes use the service-role key (bypasses RLS) for writes
-- from the plugin (validated via api_key). Authenticated admin reads via
-- dashboard also use service role on the server — never expose anon access.
alter table sites        enable row level security;
alter table forms        enable row level security;
alter table submissions  enable row level security;
alter table heartbeats   enable row level security;
alter table alerts       enable row level security;

-- Deny all for anon / authenticated by default (no policies created).
-- Server-side code uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.

-- ============================================================================
-- HELPFUL VIEWS
-- ============================================================================

-- Per-site rollup for dashboard cards
create or replace view site_stats as
select
  s.id                               as site_id,
  s.domain,
  s.display_name,
  s.is_active,
  s.last_heartbeat_at,
  s.last_submission_at,
  coalesce((select count(*) from submissions where site_id = s.id), 0)                                      as total_submissions,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '24 hours'), 0) as last_24h,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '7 days'), 0)  as last_7d,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '30 days'), 0) as last_30d,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '14 days' and submitted_at < now() - interval '7 days'), 0) as prior_7d
from sites s;

-- Daily submission counts per site for the last 60 days (feeds trend chart)
create or replace view daily_counts as
select
  s.site_id,
  date_trunc('day', s.submitted_at at time zone 'UTC')::date as day,
  count(*)                                                   as count
from submissions s
where s.submitted_at >= now() - interval '60 days'
group by s.site_id, day
order by day;
