-- Migration 003: (re)create dashboard views.
-- Your database has the tables + rows but not these views, so the
-- Overview page's SELECT returns "table not found" and renders blank.
-- Safe to re-run.

drop view if exists site_stats cascade;
drop view if exists daily_counts cascade;

create view site_stats as
select
  s.id                               as site_id,
  s.domain,
  s.display_name,
  s.is_active,
  s.last_heartbeat_at,
  s.last_submission_at,
  coalesce((select count(*) from submissions where site_id = s.id), 0) as total_submissions,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '24 hours'), 0) as last_24h,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '7 days'),  0) as last_7d,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '30 days'), 0) as last_30d,
  coalesce((select count(*) from submissions where site_id = s.id and submitted_at >= now() - interval '14 days' and submitted_at < now() - interval '7 days'), 0) as prior_7d
from sites s;

create view daily_counts as
select
  s.site_id,
  date_trunc('day', s.submitted_at at time zone 'UTC')::date as day,
  count(*) as count
from submissions s
where s.submitted_at >= now() - interval '60 days'
group by s.site_id, day
order by day;

-- Force PostgREST to refresh its schema cache so the new views are
-- visible to the Next.js app immediately (otherwise you need to wait
-- a few minutes or restart the Supabase API).
notify pgrst, 'reload schema';
