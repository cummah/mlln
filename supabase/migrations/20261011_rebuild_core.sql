-- Rebuild core schema: append-only signal store, one nightly job, price-based indicators only.
-- Apply by pasting into the Supabase SQL editor. Runs as one transaction: all or nothing.
-- Additive only. The old wide "signals" table is left alone. Nothing existing is dropped or altered here, so the live site keeps working.
-- daily_prices, assets and backtest_summary are reused as they are (the portfolio page reads them).

begin;

-- ─── buy_signals: one row per ticker, frequency and buy date ────────────────────────────────────
-- Written once when the signal fires. Indicator columns hold values as they stood on signal_date
-- (point-in-time). Only exit_* columns are filled in later, once, when an exit triggers.
-- Skipped periods (multiplier 0) are not stored. Daily rows are pruned after ~400 days.
create table if not exists buy_signals (
  ticker        text             not null,
  freq          text             not null check (freq in ('daily', 'weekly', 'monthly')),
  signal_date   date             not null,

  mult          real             not null check (mult > 0),
  entry_date    date,                         -- next trading day after signal_date
  entry_price   double precision,             -- next open plus slippage, as the engine fills

  -- Enhanced engine components on signal_date
  rsi           real,
  rsi_mult      real,
  ema_dist_pct  real,
  ema_mult      real,
  regime_adj    real,
  drawdown_pct  real,
  dd_bonus      real,
  vix           real,
  vix_bonus     real,

  -- Price-based indicators on signal_date, computed from bars up to that date only
  factor_regime   real,
  vol_timing      real,
  mean_reversion  real,
  mr_half_life    real,
  atr_pct         real,
  trend_strength  real,
  momentum_5d     real,
  weekly_align_days  integer,
  monthly_align_days integer,

  -- Exit, filled once
  exit_date              date,
  exit_price             double precision,
  exit_score             real,
  exit_next_open_date    date,
  exit_next_open_price   double precision,

  -- Trailing ATR stop breaches for multipliers 1.0, 1.5, ... 4.0 (null entries when not breached)
  atr_breach_dates   date[],
  atr_breach_prices  double precision[],

  engine_version smallint        not null default 1,
  created_at     timestamptz     not null default now(),

  primary key (ticker, freq, signal_date)
);

create index if not exists buy_signals_feed_idx on buy_signals (freq, signal_date desc);
create index if not exists buy_signals_open_idx on buy_signals (freq, ticker) where exit_date is null;

-- ─── current_signal: what the engine says on the latest bar, including "no buy" ─────────────
create table if not exists current_signal (
  ticker      text        not null,
  freq        text        not null check (freq in ('daily', 'weekly', 'monthly')),
  as_of       date        not null,
  mult        real        not null,             -- 0 means skip
  components  jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (ticker, freq)
);

-- ─── latest_prices: tiny lookup so marking to market never scans daily_prices ───────────────
create table if not exists latest_prices (
  ticker      text             primary key,
  price_date  date             not null,
  close       double precision not null,
  prev_close  double precision,
  updated_at  timestamptz      not null default now()
);

-- ─── factor model: current fit only. History is baked into signals at creation time ─────────
create table if not exists factor_loadings (
  ticker    text   primary key,
  fit_date  date   not null,
  loadings  real[] not null
);

create table if not exists factor_momentum (
  date  date   primary key,
  z     real[] not null
);

-- ─── pipeline_runs: every nightly step records its outcome, so staleness is visible ─────────
create table if not exists pipeline_runs (
  id           bigint generated always as identity primary key,
  run_date     date        not null,
  step         text        not null,
  status       text        not null check (status in ('ok', 'failed', 'partial')),
  detail       jsonb       not null default '{}'::jsonb,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists pipeline_runs_step_idx on pipeline_runs (step, finished_at desc);

-- ─── row level security: server key only. Anonymous visitors cannot read these directly ─────
alter table buy_signals      enable row level security;
alter table current_signal  enable row level security;
alter table latest_prices   enable row level security;
alter table factor_loadings enable row level security;
alter table factor_momentum enable row level security;
alter table pipeline_runs   enable row level security;

-- ─── signal_feed: what every page reads. Performance is computed here, never stored ─────────
-- Buy-and-hold performance is always against the latest stored close, so it cannot be stale or null
-- unless the signal has no entry price yet (fills after the next bar exists).
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

  (s.exit_date is null) as exit_open,
  s.exit_date,
  s.exit_price,
  case when s.entry_price > 0 and s.exit_price is not null
       then (s.exit_price / s.entry_price - 1) * 100 end as exit_return_pct,
  s.exit_score,
  s.exit_next_open_date,
  case when s.entry_price > 0 and s.exit_next_open_price is not null
       then (s.exit_next_open_price / s.entry_price - 1) * 100 end as exit_next_open_return_pct,

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
left join backtest_summary b on b.ticker = s.ticker;

-- ─── pipeline_status: newest run per step, for the "data as of" stamp on pages ──────────────
create or replace view pipeline_status with (security_invoker = true) as
select distinct on (step) step, run_date, status, detail, finished_at
from pipeline_runs
order by step, finished_at desc nulls last;

commit;
