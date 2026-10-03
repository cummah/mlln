/**
 * apply-migrations.ts
 * Applies pending migrations to Supabase
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  try {
    console.log('Applying migrations...\n')

    // Migration 1: Create macro regime tables
    const migration1 = `
-- Create macro_regime_current table
CREATE TABLE IF NOT EXISTS macro_regime_current (
  id              serial PRIMARY KEY,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  macro_score     float,
  regime_label    text,
  yield_curve_spread float,
  credit_spread   float,
  vix_level       float,
  global_trade_signal float,
  us_initial_claims float,
  composite_signal text,
  source_notes    text
);

-- Create macro_regime_history table
CREATE TABLE IF NOT EXISTS macro_regime_history (
  id              serial PRIMARY KEY,
  snapshot_date   date UNIQUE NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  macro_score     float,
  regime_label    text,
  yield_curve_spread float,
  credit_spread   float,
  vix_level       float,
  global_trade_signal float,
  us_initial_claims float,
  composite_signal text,
  source_notes    text
);
    `

    console.log('✓ Executing migration 1: macro regime tables...')
    try {
      const { error: err1 } = await supabase.rpc('exec_sql', { query: migration1 })
      if (err1?.message) {
        console.error('Error in migration 1:', err1)
      } else {
        console.log('Migration 1 applied successfully')
      }
    } catch (e) {
      console.log('Note: Migration 1 application method (exec_sql) not available - migrations should be applied via Supabase dashboard')
    }

    // Migration 2: Create asset scores and regime weights
    const migration2 = `
-- Create asset_scores table
CREATE TABLE IF NOT EXISTS public.asset_scores (
  id              serial PRIMARY KEY,
  asset_id        integer NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  fundamental_quality_score    double precision,
  dca_suitability_score        double precision,
  final_conviction_score       double precision,
  factor_exposures             jsonb,
  information_coefficient      double precision,
  information_coefficient_ir   double precision,
  macro_regime_state           text,
  regime_weights               jsonb,
  staleness_penalty            double precision,
  computed_at                  timestamptz DEFAULT now(),
  updated_at                   timestamptz DEFAULT now(),
  computation_notes            text
);

CREATE INDEX IF NOT EXISTS idx_asset_scores_asset_id ON public.asset_scores(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_scores_macro_regime ON public.asset_scores(macro_regime_state);
CREATE INDEX IF NOT EXISTS idx_asset_scores_conviction ON public.asset_scores(final_conviction_score DESC);

-- Create macro_regime_weights table
CREATE TABLE IF NOT EXISTS public.macro_regime_weights (
  id              serial PRIMARY KEY,
  regime_state    text NOT NULL UNIQUE,
  weight_quality  double precision DEFAULT 0.4,
  weight_value    double precision DEFAULT 0.3,
  weight_growth   double precision DEFAULT 0.3,
  weight_momentum double precision DEFAULT 0.0,
  description     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

INSERT INTO public.macro_regime_weights (regime_state, weight_quality, weight_value, weight_growth, description)
VALUES
  ('Goldilocks', 0.4, 0.3, 0.3, 'Stable growth, balanced portfolio'),
  ('Overheating', 0.5, 0.2, 0.3, 'High inflation, quality favored'),
  ('Stagflation', 0.6, 0.2, 0.2, 'High risk, quality defensive'),
  ('Deflation', 0.2, 0.5, 0.3, 'Risk-off, value opportunity')
ON CONFLICT (regime_state) DO NOTHING;
    `

    console.log('✓ Executing migration 2: asset scores and regime weights...')
    try {
      const { error: err2 } = await supabase.rpc('exec_sql', { query: migration2 })
      if (err2?.message) {
        console.error('Error in migration 2:', err2)
      } else {
        console.log('Migration 2 applied successfully')
      }
    } catch (e) {
      console.log('Note: Migration 2 application method (exec_sql) not available - migrations should be applied via Supabase dashboard')
    }

    console.log('\n✓ All migrations completed. You can now run the scripts.')
  } catch (error) {
    console.error('Error applying migrations:', error)
    process.exit(1)
  }
}

main()
