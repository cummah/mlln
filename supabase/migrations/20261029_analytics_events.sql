begin;

create table analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  properties jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table analytics_events enable row level security;

create policy "admin_read" on analytics_events
  for select to authenticated
  using (exists(select 1 from profiles where user_id = auth.uid() and tier = 4));

create index idx_analytics_events_event_created on analytics_events (event, created_at desc);
create index idx_analytics_events_user_created on analytics_events (user_id, created_at desc);

commit;
