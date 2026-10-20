-- Paste into the Supabase SQL editor in a NEW query tab. Additive only, one transaction.

begin;

-- Track pending Revolut payments (fail-safe for closed-tab scenario)
create table if not exists pending_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null unique,
  tier smallint not null check (tier >= 1 and tier <= 3),
  status text default 'pending', -- pending, completed, failed, expired
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone,
  checked_at timestamp with time zone
);

create index if not exists pending_payments_user_id on pending_payments(user_id);
create index if not exists pending_payments_status on pending_payments(status);
create index if not exists pending_payments_created_at on pending_payments(created_at);

-- Enable RLS
alter table pending_payments enable row level security;

-- RLS: users can read their own pending payments
create policy "users_read_own_pending_payments" on pending_payments for select
  using (auth.uid() = user_id);

commit;
