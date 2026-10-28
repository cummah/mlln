begin;

create table support_messages (
  id bigserial primary key,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamp with time zone default now()
);

alter table support_messages enable row level security;

create policy "admin_read" on support_messages
  for select to authenticated
  using (exists(select 1 from profiles where user_id = auth.uid() and tier = 4));

create index idx_support_messages_created on support_messages (created_at desc);

commit;
