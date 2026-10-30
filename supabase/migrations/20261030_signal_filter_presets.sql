-- Named signal filter presets: many per user per freq (weekly/monthly), at most one default.
-- Replaces the single-row-per-freq model from 20261027. Existing saved filters become a preset named "Default".

begin;

alter table signal_filter_preferences
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists is_default boolean not null default false,
  add column if not exists date_preset integer;

-- Backfill existing single rows
update signal_filter_preferences set id = gen_random_uuid() where id is null;
update signal_filter_preferences set name = 'Default', is_default = true where name is null;

alter table signal_filter_preferences
  alter column id set not null,
  alter column name set not null,
  drop constraint if exists signal_filter_preferences_pkey,
  add constraint signal_filter_preferences_pkey primary key (id);

-- Names are unique per user and freq, case-insensitive
create unique index if not exists signal_filter_presets_name_key
  on signal_filter_preferences (user_id, freq, lower(name));

-- At most one default per user and freq
create unique index if not exists signal_filter_presets_default_key
  on signal_filter_preferences (user_id, freq)
  where is_default;

commit;
