-- Add asset_type column to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT;

-- Create an index for faster filtering by asset type
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
