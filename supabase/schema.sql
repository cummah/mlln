CREATE TABLE IF NOT EXISTS daily_prices (
  id bigserial PRIMARY KEY,
  ticker text NOT NULL,
  date date NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume bigint,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ticker, date)
);

CREATE INDEX IF NOT EXISTS daily_prices_ticker_date ON daily_prices(ticker, date DESC);

CREATE TABLE IF NOT EXISTS assets (
  ticker text PRIMARY KEY,
  name text NOT NULL,
  sector text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_is_active ON assets(is_active);
