-- Migration 005: visitor analytics helpers for /dashboard/visitors.
--
-- Adds database-side aggregations so the analytics page doesn't need to
-- pull thousands of page_views rows into the app to compute top-N
-- rollups. Also stretches visitor_daily to 90 days so the "Last 90 days"
-- filter has data to chart.
--
-- Safe to re-run (idempotent).

-- ----------------------------------------------------------------------
-- visitor_daily: 60 → 90 days
-- ----------------------------------------------------------------------
-- Existing dashboard queries last-30-day windows, so extending the view
-- is backward compatible. The cost is minor: each added day is one more
-- aggregated row per site.
drop view if exists visitor_daily cascade;
create view visitor_daily as
select
  site_id,
  day,
  count(distinct session_hash) as visitors,
  count(*)                     as pageviews
from page_views
where day >= (now() - interval '90 days')::date
group by site_id, day
order by day;

-- ----------------------------------------------------------------------
-- pageviews_top_paths — top-N pages by views for a site + date window.
-- ----------------------------------------------------------------------
create or replace function public.pageviews_top_paths(
  p_site_id uuid default null,
  p_from    date default (now() - interval '30 days')::date,
  p_limit   int  default 20
) returns table(path text, views bigint, visitors bigint)
language sql stable as $$
  select
    coalesce(nullif(path, ''), '/') as path,
    count(*)::bigint                as views,
    count(distinct session_hash)::bigint as visitors
  from page_views
  where day >= p_from
    and (p_site_id is null or site_id = p_site_id)
  group by coalesce(nullif(path, ''), '/')
  order by views desc
  limit p_limit;
$$;

-- ----------------------------------------------------------------------
-- pageviews_top_referrers — top-N referrers normalized to hostname.
-- ----------------------------------------------------------------------
-- Null / empty referrers collapse into '(direct)' so bookmarks and typed
-- URLs show up as a distinct source instead of disappearing into the
-- unknown bucket. Anything that doesn't match the http(s) host regex
-- falls back to the raw referrer (rare edge case).
create or replace function public.pageviews_top_referrers(
  p_site_id uuid default null,
  p_from    date default (now() - interval '30 days')::date,
  p_limit   int  default 20
) returns table(host text, views bigint, visitors bigint)
language sql stable as $$
  select
    case
      when coalesce(referrer, '') = '' then '(direct)'
      else coalesce(substring(referrer from '^https?://([^/?]+)'), referrer)
    end as host,
    count(*)::bigint                as views,
    count(distinct session_hash)::bigint as visitors
  from page_views
  where day >= p_from
    and (p_site_id is null or site_id = p_site_id)
  group by case
    when coalesce(referrer, '') = '' then '(direct)'
    else coalesce(substring(referrer from '^https?://([^/?]+)'), referrer)
  end
  order by views desc
  limit p_limit;
$$;

grant execute on function public.pageviews_top_paths(uuid, date, int)     to service_role;
grant execute on function public.pageviews_top_referrers(uuid, date, int) to service_role;

notify pgrst, 'reload schema';
