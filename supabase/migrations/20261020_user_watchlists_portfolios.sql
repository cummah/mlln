-- Paste into the Supabase SQL editor in a NEW query tab. Additive only, one transaction.
-- Adds user watchlists, portfolios, and tier limits configuration

begin;

-- Add display_name to profiles
alter table profiles add column if not exists display_name text;

-- Tier limits: admin-configurable per tier (watchlists and portfolios allowed)
create table if not exists tier_limits (
  tier smallint primary key check (tier >= 0 and tier <= 3),
  max_watchlists smallint default 0,
  max_portfolios smallint default 0,
  asset_swap_limit_per_month smallint default 0,
  updated_at timestamp with time zone default now()
);

-- User's custom watchlists (tier 1: 1, tier 2: 3, tier 3: 5)
create table if not exists user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, name)
);

-- Assets in each watchlist
create table if not exists watchlist_assets (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references user_watchlists(id) on delete cascade,
  ticker text not null,
  position smallint not null default 0, -- order in watchlist
  created_at timestamp with time zone default now(),
  unique(watchlist_id, ticker)
);

-- User's saved portfolios (tier 0: 1, tier 1: 1, tier 2: 3, tier 3: 5)
create table if not exists user_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  allocation_json jsonb, -- stores {ticker: allocation_percentage, ...}
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, name)
);

-- Create indexes for faster lookups
create index if not exists user_watchlists_user_id on user_watchlists(user_id);
create index if not exists watchlist_assets_watchlist_id on watchlist_assets(watchlist_id);
create index if not exists user_portfolios_user_id on user_portfolios(user_id);

-- Enable RLS
alter table tier_limits enable row level security;
alter table user_watchlists enable row level security;
alter table watchlist_assets enable row level security;
alter table user_portfolios enable row level security;

-- RLS: everyone can read tier_limits (public config)
create policy "public_read_tier_limits" on tier_limits for select using (true);

-- RLS: users can read/insert/update/delete their own watchlists
create policy "users_read_own_watchlists" on user_watchlists for select using (auth.uid() = user_id);
create policy "users_insert_own_watchlists" on user_watchlists for insert with check (auth.uid() = user_id);
create policy "users_update_own_watchlists" on user_watchlists for update using (auth.uid() = user_id);
create policy "users_delete_own_watchlists" on user_watchlists for delete using (auth.uid() = user_id);

-- RLS: users can read/insert/update/delete assets in their watchlists (via watchlist_id)
create policy "users_read_own_watchlist_assets" on watchlist_assets for select
  using (exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid()));
create policy "users_insert_own_watchlist_assets" on watchlist_assets for insert
  with check (exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid()));
create policy "users_update_own_watchlist_assets" on watchlist_assets for update
  using (exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid()));
create policy "users_delete_own_watchlist_assets" on watchlist_assets for delete
  using (exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid()));

-- RLS: users can read/insert/update/delete their own portfolios
create policy "users_read_own_portfolios" on user_portfolios for select using (auth.uid() = user_id);
create policy "users_insert_own_portfolios" on user_portfolios for insert with check (auth.uid() = user_id);
create policy "users_update_own_portfolios" on user_portfolios for update using (auth.uid() = user_id);
create policy "users_delete_own_portfolios" on user_portfolios for delete using (auth.uid() = user_id);

-- Trigger: enforce watchlist/portfolio limits per tier
create or replace function public.check_watchlist_limit()
returns trigger as $$
declare
  user_tier smallint;
  max_allowed smallint;
  current_count int;
begin
  select tier into user_tier from profiles where user_id = new.user_id;
  select max_watchlists into max_allowed from tier_limits where tier = user_tier;
  select count(*) into current_count from user_watchlists where user_id = new.user_id;

  if max_allowed > 0 and current_count >= max_allowed then
    raise exception 'You have reached the maximum number of watchlists for your tier (% allowed)', max_allowed;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger check_watchlist_limit_trigger
  before insert on user_watchlists
  for each row execute procedure public.check_watchlist_limit();

create or replace function public.check_portfolio_limit()
returns trigger as $$
declare
  user_tier smallint;
  max_allowed smallint;
  current_count int;
begin
  select tier into user_tier from profiles where user_id = new.user_id;
  select max_portfolios into max_allowed from tier_limits where tier = user_tier;
  select count(*) into current_count from user_portfolios where user_id = new.user_id;

  if max_allowed > 0 and current_count >= max_allowed then
    raise exception 'You have reached the maximum number of portfolios for your tier (% allowed)', max_allowed;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger check_portfolio_limit_trigger
  before insert on user_portfolios
  for each row execute procedure public.check_portfolio_limit();

-- Initialize default tier_limits
insert into tier_limits (tier, max_watchlists, max_portfolios, asset_swap_limit_per_month) values
(0, 0, 1, 0),  -- Free: no custom watchlists, 1 portfolio
(1, 1, 1, 5),  -- Essential: 1 watchlist, 1 portfolio, 5 asset swaps/month
(2, 3, 3, 0),  -- Full: 3 watchlists, 3 portfolios
(3, 5, 5, 0)   -- Pro: 5 watchlists, 5 portfolios
on conflict do nothing;

commit;
