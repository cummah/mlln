-- Second rebuild migration. Paste into the Supabase SQL editor after the first one. One transaction.
--
-- 1. Walk-forward factor model storage. Replaces two empty, unused factor tables.
--    factor_loadings: the CURRENT monthly fit only. Each ticker's exposure to the 5 factors plus the
--      mean and spread of its returns in the fit window, used to standardise each new day's return.
--    factor_series: one row per trading day. score is that day's factor return under the fit active on
--      that day, z is the factor momentum z-score. Signals copy the resulting factor regime when they
--      are created, so history is never recomputed later.
-- 2. Exits become append-only events. A held signal exits on the first later evaluation date whose
--    exit score reaches the threshold, so one event row per ticker, frequency and date covers every
--    open signal. signal_feed derives each signal's exit from that table, which removes thousands of
--    row updates per night. buy_signals loses its five exit columns (the table is empty).

begin;

-- ─── factor model ──────────────────────────────────────────────────────────────────────────
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

-- ─── exits ─────────────────────────────────────────────────────────────────────────────────
drop view if exists signal_feed;

alter table buy_signals
  drop column if exists exit_date,
  drop column if exists exit_price,
  drop column if exists exit_score,
  drop column if exists exit_next_open_date,
  drop column if exists exit_next_open_price;

create table exit_events (
  ticker         text             not null,
  freq           text             not null check (freq in ('daily', 'weekly', 'monthly')),
  event_date     date             not null,
  score          real             not null,
  close          double precision not null,   -- sale at this day's close
  next_open_date date,                        -- filled the following night
  next_open      double precision,            -- sale at next open less slippage
  primary key (ticker, freq, event_date)
);

alter table factor_loadings enable row level security;
alter table factor_series   enable row level security;
alter table exit_events     enable row level security;

-- ─── signal_feed, rebuilt: exits derived from exit_events ─────────────────────────────────
create or replace view signal_feed with (security_invoker = true) as
select
  s.ticker,
  a.name,
  a.sector,
  a.tags,
  s.freq,
  s.signal_date,
  s.mult,
  s.entry_date,
  s.entry_price,
  lp.close       as latest_price,
  lp.price_date  as price_date,
  case when s.entry_price > 0 then (lp.close / s.entry_price - 1) * 100 end as performance_pct,

  (x.event_date is null) as exit_open,
  x.event_date           as exit_date,
  x.close                as exit_price,
  case when s.entry_price > 0 and x.close is not null
       then (x.close / s.entry_price - 1) * 100 end as exit_return_pct,
  x.score                as exit_score,
  x.next_open_date       as exit_next_open_date,
  case when s.entry_price > 0 and x.next_open is not null
       then (x.next_open / s.entry_price - 1) * 100 end as exit_next_open_return_pct,

  s.atr_breach_dates,
  (select array_agg(case when p is null or s.entry_price <= 0 then null
                         else (p / s.entry_price - 1) * 100 end order by i)
     from unnest(s.atr_breach_prices) with ordinality as t(p, i)) as atr_breach_returns,

  s.rsi, s.rsi_mult, s.ema_dist_pct, s.ema_mult, s.regime_adj,
  s.drawdown_pct, s.dd_bonus, s.vix, s.vix_bonus,
  s.factor_regime, s.vol_timing, s.mean_reversion, s.mr_half_life,
  s.atr_pct, s.trend_strength, s.momentum_5d,
  s.weekly_align_days, s.monthly_align_days,

  b.dca_suitability_score,
  case when s.freq = 'monthly' then b.monthly_alpha_5y else b.alpha_5y end as ticker_alpha_5y
from buy_signals s
join assets a            on a.ticker = s.ticker and a.is_active
left join latest_prices lp on lp.ticker = s.ticker
left join backtest_summary b on b.ticker = s.ticker
left join lateral (
  select e.event_date, e.close, e.score, e.next_open_date, e.next_open
  from exit_events e
  where e.ticker = s.ticker and e.freq = s.freq and e.event_date > s.signal_date
  order by e.event_date
  limit 1
) x on true;

commit;
