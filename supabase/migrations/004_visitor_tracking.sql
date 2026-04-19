-- Migration 004: privacy-friendly visitor tracking.
-- No cookies, no personal data stored. Session uniqueness is a daily
-- hash of IP + user-agent + site_id, which means we can count unique
-- visitors per day but cannot track anyone across days.
--
-- Safe to re-run (idempotent).

create table if not exists page_views (
  id            bigserial primary key,
  site_id       uuid not null references sites(id) on delete cascade,
  occurred_at   timestamptz not null default now(),
  day           date not null default (now() at time zone 'UTC')::date,
  session_hash  text not null,
  path          text,
  referrer      text
);

create index if not exists idx_page_views_site_occurred on page_views (site_id, occurred_at desc);
create index if not exists idx_page_views_site_day      on page_views (site_id, day);
create index if not exists idx_page_views_session_day   on page_views (site_id, day, session_hash);

alter table page_views enable row level security;

-- ============================================================================
-- VIEWS
-- ============================================================================

drop view if exists visitor_stats cascade;
drop view if exists visitor_daily cascade;

-- Per-site rollup for dashboard cards (analogous to site_stats).
create view visitor_stats as
select
  s.id as site_id,
  coalesce((select count(distinct session_hash) from page_views where site_id = s.id and occurred_at >= now() - interval '24 hours'), 0) as visitors_24h,
  coalesce((select count(distinct session_hash) from page_views where site_id = s.id and occurred_at >= now() - interval '7 days'),  0) as visitors_7d,
  coalesce((select count(distinct session_hash) from page_views where site_id = s.id and occurred_at >= now() - interval '30 days'), 0) as visitors_30d,
  coalesce((select count(distinct session_hash) from page_views where site_id = s.id and occurred_at >= now() - interval '14 days' and occurred_at < now() - interval '7 days'), 0) as visitors_prior_7d,
  coalesce((select count(*) from page_views where site_id = s.id and occurred_at >= now() - interval '24 hours'), 0) as pageviews_24h,
  coalesce((select count(*) from page_views where site_id = s.id and occurred_at >= now() - interval '7 days'),  0) as pageviews_7d,
  coalesce((select count(*) from page_views where site_id = s.id and occurred_at >= now() - interval '30 days'), 0) as pageviews_30d
from sites s;

-- Daily visitor counts for the sparkline — last 60 days.
create view visitor_daily as
select
  site_id,
  day,
  count(distinct session_hash) as visitors,
  count(*)                     as pageviews
from page_views
where day >= (now() - interval '60 days')::date
group by site_id, day
order by day;

notify pgrst, 'reload schema';
