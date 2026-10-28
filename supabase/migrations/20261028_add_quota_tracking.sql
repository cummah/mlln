-- Add quota reset tracking to profiles
alter table if exists profiles add column quota_reset_date timestamp with time zone default now();

-- Audit table for tracking asset swaps (monthly quota enforcement)
create table if not exists watchlist_assets_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_id uuid not null references user_watchlists(id) on delete cascade,
  ticker text not null,
  action text not null check (action in ('add', 'remove')),
  created_at timestamp with time zone default now()
);

-- Index for monthly quota checks
create index if not exists idx_watchlist_assets_audit_user_month
  on watchlist_assets_audit(user_id, created_at desc);

-- RLS for audit table (users can only see their own audit trail, admin can see all)
alter table watchlist_assets_audit enable row level security;

drop policy if exists "users_read_own_audit" on watchlist_assets_audit;
drop policy if exists "admin_read_all_audit" on watchlist_assets_audit;

create policy "users_read_own_audit" on watchlist_assets_audit for select using (auth.uid() = user_id);
create policy "admin_read_all_audit" on watchlist_assets_audit for select using (
  exists (select 1 from profiles where user_id = auth.uid() and tier = 4)
);
