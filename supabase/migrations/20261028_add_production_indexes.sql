-- Production performance indexes for hot query paths
-- These are based on actual API and script query patterns

-- Assets table: frequently filtered by is_active, ordered by ticker
CREATE INDEX IF NOT EXISTS idx_assets_is_active ON assets(is_active);
CREATE INDEX IF NOT EXISTS idx_assets_ticker ON assets(ticker);

-- Daily prices: main data table, queried by ticker and date ranges
CREATE INDEX IF NOT EXISTS idx_daily_prices_ticker_date ON daily_prices(ticker, date DESC);

-- Buy signals: underlying table for signal_feed view, queried by ticker, freq, and date
CREATE INDEX IF NOT EXISTS idx_buy_signals_ticker_freq_date ON buy_signals(ticker, freq, signal_date DESC);

-- User tables: all filtered by user_id
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user_id ON user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlists_user_id ON user_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON user_assets(user_id);

-- Signal pruning: buy_signals and exit_events filtered by freq and date
CREATE INDEX IF NOT EXISTS idx_buy_signals_freq_date ON buy_signals(freq, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_exit_events_freq_date ON exit_events(freq, event_date DESC);
