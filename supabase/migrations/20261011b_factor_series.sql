-- Walk-forward factor model storage. Replaces the two empty factor tables from the core migration.
-- Both tables are empty and unused, so dropping them loses nothing. Paste into the SQL editor.
--
-- factor_loadings: the CURRENT monthly fit only. Each ticker's exposure to the 5 factors plus the
--   mean and spread of its returns in the fit window, used to standardise each new day's return.
-- factor_series: one row per trading day. score is that day's factor return under the fit active
--   on that day, z is the factor momentum z-score derived from the trailing score history.
--   On each monthly refit the trailing rows are rewritten under the new fit. Signals copy the
--   resulting factor regime value when they are created, so history is never recomputed later.

begin;

drop table if exists factor_momentum;
drop table if exists factor_loadings;

create table factor_loadings (
  ticker    text             primary key,
  fit_date  date             not null,
  loadings  real[]           not null,
  mean_ret  double precision not null,
  std_ret   double precision not null
);

create table factor_series (
  date      date   primary key,
  fit_date  date   not null,
  score     real[] not null,
  z         real[]
);

alter table factor_loadings enable row level security;
alter table factor_series   enable row level security;

commit;
