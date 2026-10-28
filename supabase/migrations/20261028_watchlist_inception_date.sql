-- Add inception_date column to user_watchlists for custom watchlist historical tracking.
-- Default: one year ago. User can set to track 1-6 years back.
-- Apply this in the Supabase SQL editor in a NEW query tab.

begin;

alter table user_watchlists
  add column if not exists inception_date date not null default (current_date - interval '1 year');

commit;
