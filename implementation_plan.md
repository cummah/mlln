# Institutional-Grade Scoring System for app/asset

## Scope: app/asset Only
- New scoring system applies **only to app/asset section**
- Existing app/dashboard and app/sectors remain unchanged
- New database columns are nullable/optional (backward compatible)
- New tables (macro_regime, asset_scores) are isolated

## Decisions Made
1. **Macro Data Source**: FRED API + Yahoo Finance indices
2. **LLM**: Anthropic Claude API (ANTHROPIC_API_KEY in .env)
3. **Regime Weights**: Use sensible defaults for now
   - Goldilocks: Quality 40%, Value 30%, Growth 30%
   - Overheating: Quality 50%, Value 20%, Growth 30%
   - Stagflation: Quality 60%, Value 20%, Growth 20%
   - Deflation: Quality 20%, Value 50%, Growth 30%

## Phase 1: Database Schema

### New Tables
- `macro_regime` — Current and historical macro classification
- `asset_scores` — Computed scores for each asset (app/asset only)

### Altered Tables
- `assets` — Add metadata, tags, and financial metrics (nullable)

### Indexes
- GIN index on assets.tags for fast filtering

## Phase 2: Scripts
- `scripts/update-macro-regime.ts` — Fetch macro data, classify regime
- `scripts/update-fundamentals.ts` — Fetch Yahoo Finance, generate tags via Claude
- `scripts/compute-conviction-scores.ts` — Compute scores and store in asset_scores

## Phase 3: API Routes
- `app/api/asset-scores/[ticker]/route.ts` — Fetch scores for app/asset
- `app/api/macro-regime/current/route.ts` — Get current regime state

## Phase 4: UI Components (app/asset)
- MatrixView (2D scatter: DCA vs Fundamental Quality)
- TagFilter (filter by AI-generated tags)
- ScorePanel (display conviction + staleness)

## Implementation Status
- [x] Phase 1: Database migrations
  - `supabase/migrations/20260528_create_asset_scores.sql`
  - New tables: `asset_scores`, `macro_regime_weights` with seed data
  - Indexes for fast querying
- [x] Phase 2: Scripts (Ready to run)
  - `scripts/update-macro-regime.ts` — Fetches FRED API + Yahoo Finance, classifies regime
  - `scripts/update-fundamentals.ts` — Yahoo Finance fundamentals + Claude tag generation
  - `scripts/compute-conviction-scores.ts` — Z-score, blending, staleness penalty computation
- [x] Phase 3: API routes
  - `app/api/asset-scores/[ticker]/route.ts` — Fetch scores for specific ticker
  - `app/api/macro-regime/current/route.ts` — Get current macro regime + history
- [x] Phase 4: UI components
  - `components/asset-scores/ScorePanel.tsx` — Displays conviction, fundamental quality, DCA suitability, staleness
  - `components/asset-scores/TagBadges.tsx` — Shows AI-generated tags
  - `components/asset-scores/AssetScoresSection.tsx` — Client component that fetches and integrates both

## Execution Complete ✓

### ✓ 1. Database Migrations Applied
- `macro_regime_current` & `macro_regime_history` tables created
- `asset_scores` table created with conviction score columns
- `macro_regime_weights` table seeded with regime weights

### ✓ 2. Scripts Executed
```
✓ update-macro-regime.ts → Macro regime set to "Deflation" (score: 52)
✓ update-fundamentals.ts → Fetched fundamentals for 50 assets
✓ compute-conviction-scores.ts → Computed scores for 716 assets (0 failures)
```

### ✓ 3. Components Integrated
- Added `AssetScoresSection` to `app/asset/[ticker]/page.tsx`
- Import added to page component
- Component renders after AssetHeader

### ✓ 4. Ready to Test
Navigate to any asset page, e.g.:
- https://your-app/asset/AAPL
- https://your-app/asset/MSFT

You should see:
- **Score Panel** with conviction + fundamental quality scores
- **Macro Context** panel (VIX, yield curve, regime)
- **Data Freshness** indicator with staleness penalty
- Existing dashboard (`/dashboard/AAPL`) remains unchanged
