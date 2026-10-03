-- Create sector_stats table to pre-compute sector aggregates for instant page loads
CREATE TABLE IF NOT EXISTS sector_stats (
  id BIGSERIAL PRIMARY KEY,
  sector VARCHAR(100) NOT NULL UNIQUE,

  -- Real-time aggregates (updated weekly)
  total_assets INTEGER NOT NULL DEFAULT 0,
  avg_rsi NUMERIC(5, 2) NOT NULL DEFAULT 50,
  assets_in_buy_zone INTEGER NOT NULL DEFAULT 0,

  -- Recent returns (1M, 3M, 1Y)
  sector_return_1m NUMERIC(8, 2) NOT NULL DEFAULT 0,
  sector_return_3m NUMERIC(8, 2) NOT NULL DEFAULT 0,
  sector_return_1y NUMERIC(8, 2) NOT NULL DEFAULT 0,

  -- Metadata
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_sector CHECK (sector != '')
);

-- Create index for fast lookups by sector
CREATE INDEX IF NOT EXISTS idx_sector_stats_sector ON sector_stats(sector);
CREATE INDEX IF NOT EXISTS idx_sector_stats_updated_at ON sector_stats(updated_at);
