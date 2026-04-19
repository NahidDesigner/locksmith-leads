-- Migration 002: collapse submissions.status to a binary success/failed.
-- Elementor's Actions Status is shown as green check or warning — no
-- "pending" or "spam" buckets. Anything that isn't a clean success is
-- a failure from the client's point of view.
--
-- Run in Supabase SQL Editor. Safe to re-run.

alter table submissions drop constraint if exists submissions_status_check;

-- Normalize any existing rows to the new set.
update submissions set status = 'failed' where status not in ('success', 'failed');

alter table submissions
  add constraint submissions_status_check
  check (status in ('success','failed'));
