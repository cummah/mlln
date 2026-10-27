-- Signal filter preferences: one per user per frequency (weekly/monthly)
-- Stores user's saved filters and strategy for each signal page

begin;

create table if not exists signal_filter_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  freq text not null check (freq in ('weekly', 'monthly')),
  filters jsonb not null,
  strategy jsonb not null,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  primary key (user_id, freq)
);

-- Enable RLS
alter table signal_filter_preferences enable row level security;

-- RLS: users can read/write only their own preferences
create policy "users_read_own_signal_preferences" on signal_filter_preferences
  for select using (auth.uid() = user_id);

create policy "users_insert_own_signal_preferences" on signal_filter_preferences
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_signal_preferences" on signal_filter_preferences
  for update using (auth.uid() = user_id);

create policy "users_delete_own_signal_preferences" on signal_filter_preferences
  for delete using (auth.uid() = user_id);

commit;
