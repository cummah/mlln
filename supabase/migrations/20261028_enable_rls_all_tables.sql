-- Comprehensive RLS enablement for all tables (defense in depth)
-- Strategy:
-- 1. User-specific tables: auth.uid() = user_id
-- 2. Public lookup tables: public read, admin-only write
-- 3. Public data tables: public read (tier-gating stays at app layer)

begin;

-- ============================================================================
-- USER-SPECIFIC TABLES (per-user access)
-- ============================================================================

-- user_watchlists
alter table if exists user_watchlists enable row level security;
drop policy if exists "users_read_own_watchlists" on user_watchlists;
drop policy if exists "users_insert_own_watchlists" on user_watchlists;
drop policy if exists "users_update_own_watchlists" on user_watchlists;
drop policy if exists "users_delete_own_watchlists" on user_watchlists;

create policy "users_read_own_watchlists" on user_watchlists for select using (auth.uid() = user_id);
create policy "users_insert_own_watchlists" on user_watchlists for insert with check (auth.uid() = user_id);
create policy "users_update_own_watchlists" on user_watchlists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_delete_own_watchlists" on user_watchlists for delete using (auth.uid() = user_id);

-- user_portfolios
alter table if exists user_portfolios enable row level security;
drop policy if exists "users_read_own_portfolios" on user_portfolios;
drop policy if exists "users_insert_own_portfolios" on user_portfolios;
drop policy if exists "users_update_own_portfolios" on user_portfolios;
drop policy if exists "users_delete_own_portfolios" on user_portfolios;

create policy "users_read_own_portfolios" on user_portfolios for select using (auth.uid() = user_id);
create policy "users_insert_own_portfolios" on user_portfolios for insert with check (auth.uid() = user_id);
create policy "users_update_own_portfolios" on user_portfolios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_delete_own_portfolios" on user_portfolios for delete using (auth.uid() = user_id);

-- pending_payments (user-specific + sensitive)
alter table if exists pending_payments enable row level security;
drop policy if exists "users_read_own_payments" on pending_payments;
drop policy if exists "users_insert_own_payments" on pending_payments;

create policy "users_read_own_payments" on pending_payments for select using (auth.uid() = user_id);
create policy "system_insert_payments" on pending_payments for insert with check (auth.uid() = user_id);

-- ============================================================================
-- ADMIN-CONTROLLED LOOKUP TABLES (public read, admin-only write)
-- ============================================================================

-- tier_limits (admin config)
alter table if exists tier_limits enable row level security;
drop policy if exists "public_read_tier_limits" on tier_limits;
drop policy if exists "admin_write_tier_limits" on tier_limits;

create policy "public_read_tier_limits" on tier_limits for select using (true);
create policy "admin_write_tier_limits" on tier_limits for update using (
  exists (select 1 from profiles where user_id = auth.uid() and tier = 4)
);
create policy "admin_delete_tier_limits" on tier_limits for delete using (
  exists (select 1 from profiles where user_id = auth.uid() and tier = 4)
);

-- ============================================================================
-- PUBLIC DATA TABLES (public read, no direct writes from app)
-- Note: These are read-only at the database layer. Tier-gating is at app layer.
-- ============================================================================

-- daily_signal_enrichment
alter table if exists daily_signal_enrichment enable row level security;
drop policy if exists "public_read_daily_signals" on daily_signal_enrichment;
create policy "public_read_daily_signals" on daily_signal_enrichment for select using (true);

-- weekly_signal_enrichment
alter table if exists weekly_signal_enrichment enable row level security;
drop policy if exists "public_read_weekly_signals" on weekly_signal_enrichment;
create policy "public_read_weekly_signals" on weekly_signal_enrichment for select using (true);

-- monthly_signal_enrichment
alter table if exists monthly_signal_enrichment enable row level security;
drop policy if exists "public_read_monthly_signals" on monthly_signal_enrichment;
create policy "public_read_monthly_signals" on monthly_signal_enrichment for select using (true);

-- asset_scores
alter table if exists asset_scores enable row level security;
drop policy if exists "public_read_asset_scores" on asset_scores;
create policy "public_read_asset_scores" on asset_scores for select using (true);

-- asset_scores_history
alter table if exists asset_scores_history enable row level security;
drop policy if exists "public_read_asset_scores_history" on asset_scores_history;
create policy "public_read_asset_scores_history" on asset_scores_history for select using (true);

-- asset_macro_metrics
alter table if exists asset_macro_metrics enable row level security;
drop policy if exists "public_read_asset_macro_metrics" on asset_macro_metrics;
create policy "public_read_asset_macro_metrics" on asset_macro_metrics for select using (true);

-- asset_backtest_macro
alter table if exists public.asset_backtest_macro enable row level security;
drop policy if exists "public_read_asset_backtest_macro" on public.asset_backtest_macro;
create policy "public_read_asset_backtest_macro" on public.asset_backtest_macro for select using (true);

-- backtest_summary_macro
alter table if exists public.backtest_summary_macro enable row level security;
drop policy if exists "public_read_backtest_summary_macro" on public.backtest_summary_macro;
create policy "public_read_backtest_summary_macro" on public.backtest_summary_macro for select using (true);

-- backtest_summary (generic)
alter table if exists backtest_summary enable row level security;
drop policy if exists "public_read_backtest_summary" on backtest_summary;
create policy "public_read_backtest_summary" on backtest_summary for select using (true);

-- backtest_signals
alter table if exists backtest_signals enable row level security;
drop policy if exists "public_read_backtest_signals" on backtest_signals;
create policy "public_read_backtest_signals" on backtest_signals for select using (true);

-- daily_signals
alter table if exists daily_signals enable row level security;
drop policy if exists "public_read_daily_signals_table" on daily_signals;
create policy "public_read_daily_signals_table" on daily_signals for select using (true);

-- signals table
alter table if exists signals enable row level security;
drop policy if exists "public_read_signals" on signals;
create policy "public_read_signals" on signals for select using (true);

-- signal_history
alter table if exists signal_history enable row level security;
drop policy if exists "public_read_signal_history" on signal_history;
create policy "public_read_signal_history" on signal_history for select using (true);

-- macro regime tables
alter table if exists macro_regime_current enable row level security;
drop policy if exists "public_read_macro_regime_current" on macro_regime_current;
create policy "public_read_macro_regime_current" on macro_regime_current for select using (true);

alter table if exists macro_regime_history enable row level security;
drop policy if exists "public_read_macro_regime_history" on macro_regime_history;
create policy "public_read_macro_regime_history" on macro_regime_history for select using (true);

alter table if exists public.macro_regime_history enable row level security;
drop policy if exists "public_read_public_macro_regime_history" on public.macro_regime_history;
create policy "public_read_public_macro_regime_history" on public.macro_regime_history for select using (true);

-- macro weights
alter table if exists public.macro_regime_weights enable row level security;
drop policy if exists "public_read_macro_regime_weights" on public.macro_regime_weights;
create policy "public_read_macro_regime_weights" on public.macro_regime_weights for select using (true);

-- macro signal components
alter table if exists public.macro_signal_components enable row level security;
drop policy if exists "public_read_macro_signal_components" on public.macro_signal_components;
create policy "public_read_macro_signal_components" on public.macro_signal_components for select using (true);

-- factor model tables
alter table if exists public.factor_model_loadings enable row level security;
drop policy if exists "public_read_factor_model_loadings" on public.factor_model_loadings;
create policy "public_read_factor_model_loadings" on public.factor_model_loadings for select using (true);

alter table if exists public.factor_model_history enable row level security;
drop policy if exists "public_read_factor_model_history" on public.factor_model_history;
create policy "public_read_factor_model_history" on public.factor_model_history for select using (true);

alter table if exists factor_loadings enable row level security;
drop policy if exists "public_read_factor_loadings" on factor_loadings;
create policy "public_read_factor_loadings" on factor_loadings for select using (true);

alter table if exists factor_series enable row level security;
drop policy if exists "public_read_factor_series" on factor_series;
create policy "public_read_factor_series" on factor_series for select using (true);

-- exit events
alter table if exists exit_events enable row level security;
drop policy if exists "public_read_exit_events" on exit_events;
create policy "public_read_exit_events" on exit_events for select using (true);

-- latest prices
alter table if exists latest_prices enable row level security;
drop policy if exists "public_read_latest_prices" on latest_prices;
create policy "public_read_latest_prices" on latest_prices for select using (true);

-- buy signals
alter table if exists buy_signals enable row level security;
drop policy if exists "public_read_buy_signals" on buy_signals;
create policy "public_read_buy_signals" on buy_signals for select using (true);

-- current signal
alter table if exists current_signal enable row level security;
drop policy if exists "public_read_current_signal" on current_signal;
create policy "public_read_current_signal" on current_signal for select using (true);

-- pipeline runs (admin-only)
alter table if exists pipeline_runs enable row level security;
drop policy if exists "admin_read_pipeline_runs" on pipeline_runs;
create policy "admin_read_pipeline_runs" on pipeline_runs for select using (
  exists (select 1 from profiles where user_id = auth.uid() and tier = 4)
);

-- signal_filter_preferences (user-specific)
alter table if exists signal_filter_preferences enable row level security;
drop policy if exists "users_read_own_filters" on signal_filter_preferences;
drop policy if exists "users_write_own_filters" on signal_filter_preferences;
drop policy if exists "users_update_own_filters" on signal_filter_preferences;

create policy "users_read_own_filters" on signal_filter_preferences for select using (auth.uid() = user_id);
create policy "users_write_own_filters" on signal_filter_preferences for insert with check (auth.uid() = user_id);
create policy "users_update_own_filters" on signal_filter_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- watchlist_assets (user-specific via watchlist owner)
alter table if exists watchlist_assets enable row level security;
drop policy if exists "users_read_own_watchlist_assets" on watchlist_assets;
drop policy if exists "users_insert_own_watchlist_assets" on watchlist_assets;
drop policy if exists "users_delete_own_watchlist_assets" on watchlist_assets;

create policy "users_read_own_watchlist_assets" on watchlist_assets for select using (
  exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid())
);
create policy "users_insert_own_watchlist_assets" on watchlist_assets for insert with check (
  exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid())
);
create policy "users_delete_own_watchlist_assets" on watchlist_assets for delete using (
  exists (select 1 from user_watchlists where id = watchlist_id and user_id = auth.uid())
);

-- daily_signal_atr_breaches (public read)
alter table if exists daily_signal_atr_breaches enable row level security;
drop policy if exists "public_read_daily_signal_atr_breaches" on daily_signal_atr_breaches;
create policy "public_read_daily_signal_atr_breaches" on daily_signal_atr_breaches for select using (true);

commit;
