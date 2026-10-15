-- Paste into the Supabase SQL editor in a NEW query tab. Additive only, one transaction.

begin;

-- Profiles: one per authenticated user
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier smallint default 0 check (tier >= 0 and tier <= 3),
  tradingview_enabled boolean default false,
  billing_provider text,
  billing_customer_id text,
  current_period_end timestamp with time zone,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- User's chosen assets (max 20 for tier 1)
create table if not exists user_assets (
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  created_at timestamp with time zone default now(),
  primary key (user_id, ticker)
);

-- Admin-controlled tier permissions per section
create table if not exists tier_permissions (
  section text not null,
  tier smallint not null check (tier >= 0 and tier <= 3),
  can_view_latest_signal boolean default false,
  updated_at timestamp with time zone default now(),
  primary key (section, tier)
);

-- Enable RLS
alter table profiles enable row level security;
alter table user_assets enable row level security;
alter table tier_permissions enable row level security;

-- RLS: users can read/update their own profile
create policy "users_read_own_profile" on profiles for select using (auth.uid() = user_id);
create policy "users_update_own_profile" on profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id and tier = (select tier from profiles where user_id = auth.uid()));

-- RLS: users can read tier (not write)
alter policy "users_update_own_profile" on profiles for update using (false);

-- RLS: users can read/update their own assets
create policy "users_read_own_assets" on user_assets for select using (auth.uid() = user_id);
create policy "users_insert_own_assets" on user_assets for insert with check (auth.uid() = user_id);
create policy "users_delete_own_assets" on user_assets for delete using (auth.uid() = user_id);

-- RLS: everyone can read tier_permissions (public config)
create policy "public_read_tier_permissions" on tier_permissions for select using (true);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: enforce max 20 assets for tier 1
create or replace function public.check_asset_limit()
returns trigger as $$
declare
  user_tier smallint;
  asset_count int;
begin
  select tier into user_tier from profiles where user_id = new.user_id;
  select count(*) into asset_count from user_assets where user_id = new.user_id;

  if user_tier = 1 and asset_count > 20 then
    raise exception 'Tier 1 users can only have 20 assets';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger check_tier1_asset_limit
  before insert on user_assets
  for each row execute procedure public.check_asset_limit();

-- Initialize default tier_permissions (all sections, all tiers: tier 2/3 can see, tier 0/1 cannot by default)
-- Admin can toggle these in the dashboard
insert into tier_permissions (section, tier, can_view_latest_signal) values
('asset_page', 0, false),
('asset_page', 1, false),
('asset_page', 2, true),
('asset_page', 3, true),
('rank', 0, false),
('rank', 1, false),
('rank', 2, true),
('rank', 3, true),
('sectors', 0, false),
('sectors', 1, false),
('sectors', 2, true),
('sectors', 3, true),
('watchlist', 0, false),
('watchlist', 1, false),
('watchlist', 2, true),
('watchlist', 3, true),
('weekly_signals', 0, false),
('weekly_signals', 1, false),
('weekly_signals', 2, true),
('weekly_signals', 3, true),
('monthly_signals', 0, false),
('monthly_signals', 1, false),
('monthly_signals', 2, true),
('monthly_signals', 3, true)
on conflict do nothing;

commit;
