-- Migration 001: track per-submission action-outcome status.
-- Elementor Pro stores this in wp_e_submissions.status. We mirror it so
-- the dashboard can flag failed/spam submissions for the client.
--
-- Run in Supabase SQL Editor once. Safe to re-run.

alter table submissions
  add column if not exists status text not null default 'success';

-- Drop the old check if we had one, then re-add with the full set.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'submissions_status_check'
  ) then
    alter table submissions drop constraint submissions_status_check;
  end if;
end$$;

alter table submissions
  add constraint submissions_status_check
  check (status in ('success','failed','pending','spam','unknown'));

create index if not exists idx_submissions_site_status on submissions (site_id, status);
