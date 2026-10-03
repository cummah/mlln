-- Step 4: Verify Solution 2 Implementation
-- Corrected query with proper join to assets table

SELECT 
  a.ticker,
  a.sector,
  s.dca_suitability_score,
  s.sector_modifier,
  s.final_conviction_score,
  s.macro_regime_state
FROM asset_scores s
INNER JOIN assets a ON s.asset_id = a.id
WHERE a.ticker IN ('TSLA', 'XLE', 'JNJ')
ORDER BY a.ticker;
