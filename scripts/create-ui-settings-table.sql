-- Create UI settings table for configurable sector page values
CREATE TABLE IF NOT EXISTS ui_settings (
  id BIGSERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  data_type VARCHAR(20), -- 'integer', 'string', 'boolean'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO ui_settings (setting_key, setting_value, description, data_type) VALUES
  ('sector_top_performers_count', '3', 'Number of top performers to show in sector insight text', 'integer'),
  ('sector_top_performers_example_count', '2', 'Number of ticker examples to show in insight text', 'integer'),
  ('sector_related_count', '4', 'Number of related sectors to show', 'integer'),
  ('sector_skeleton_loaders_count', '10', 'Number of skeleton loaders to show while loading', 'integer'),
  ('sector_signal_reasoning_truncate_chars', '30', 'Number of characters to show for signal reasoning (0 = full text)', 'integer'),
  ('sector_recent_signals_days_window', '30', 'Number of days for "Recently Strong Signals" tab', 'integer'),
  ('sector_stats_periods_to_show', '1M,3M,1Y', 'Comma-separated list of return periods to display', 'string'),
  ('sector_table_rows_limit', '10', 'Maximum rows to show in sector tables', 'integer'),
  ('sector_top_performers_limit', '10', 'Maximum number of top performers to fetch', 'integer')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ui_settings_key ON ui_settings(setting_key);
