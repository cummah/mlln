/**
 * migrate-atr-breaches.ts
 *
 * Denormalizes ATR breach data from signals_1y JSON to a separate table.
 * This shrinks signals_1y significantly, allowing larger chunk sizes in upserts.
 *
 * Steps:
 *   1. Create daily_signal_atr_breaches table (idempotent)
 *   2. Extract ATR breach data from daily_signals.signals_1y
 *   3. Insert into daily_signal_atr_breaches
 *   4. Remove atrStopBreachDates/atrStopBreachReturns from signals_1y
 *   5. Update daily_signals with the leaner signals_1y
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/migrate-atr-breaches.ts
 *
 * Safe to re-run; uses INSERT ... ON CONFLICT DO NOTHING to skip duplicates.
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

const ATR_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
const BATCH_SIZE = 50

async function main() {
  console.log('Starting ATR breach data migration...\n')

  // Step 1: Create table
  console.log('Step 1: Creating daily_signal_atr_breaches table...')
  const migrationSQL = fs.readFileSync(
    path.resolve(__dirname, '../supabase/migrations/20260905_denormalize_atr_breaches.sql'),
    'utf-8'
  )
  const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL })
  if (migrationError) {
    console.error('Error creating table:', migrationError)
    process.exit(1)
  }
  console.log('✓ Table created\n')

  // Step 2: Fetch all daily_signals rows
  console.log('Step 2: Fetching daily_signals data...')
  const { data: allSignalRows, error: fetchError } = await supabase
    .from('daily_signals')
    .select('ticker, signals_1y')
    .not('signals_1y', 'is', null)

  if (fetchError || !allSignalRows) {
    console.error('Error fetching signals:', fetchError)
    process.exit(1)
  }

  console.log(`Found ${allSignalRows.length} tickers with signals\n`)

  // Step 3: Extract and insert ATR breaches
  console.log('Step 3: Extracting and inserting ATR breaches...')
  let totalBreaches = 0

  for (const row of allSignalRows) {
    const ticker = row.ticker
    const signals = (row.signals_1y as any[]) || []

    // Collect all breaches for this ticker
    const breaches: any[] = []
    for (const signal of signals) {
      if (!signal.date) continue

      const breachDates = signal.atrStopBreachDates || []
      const breachReturns = signal.atrStopBreachReturns || []

      for (let i = 0; i < ATR_MULTIPLIERS.length; i++) {
        const breachDate = breachDates[i]
        const breachReturn = breachReturns[i]

        // Only store non-null breaches
        if (breachDate !== null && breachDate !== undefined) {
          breaches.push({
            ticker,
            signal_date: signal.date,
            atr_multiplier: ATR_MULTIPLIERS[i],
            breach_date: breachDate,
            breach_return: breachReturn ?? null,
          })
        }
      }
    }

    if (breaches.length > 0) {
      const { error: insertError } = await supabase
        .from('daily_signal_atr_breaches')
        .upsert(breaches, { onConflict: 'ticker,signal_date,atr_multiplier' })

      if (insertError) {
        console.error(`Error inserting breaches for ${ticker}:`, insertError)
      } else {
        totalBreaches += breaches.length
      }
    }
  }

  console.log(`✓ Inserted ${totalBreaches} ATR breach records\n`)

  // Step 4: Remove ATR fields from signals_1y
  console.log('Step 4: Removing ATR fields from signals_1y...')
  let updatedCount = 0

  for (let batchStart = 0; batchStart < allSignalRows.length; batchStart += BATCH_SIZE) {
    const batch = allSignalRows.slice(batchStart, batchStart + BATCH_SIZE)

    const updates = batch.map(row => {
      const signals = (row.signals_1y as any[]) || []
      const leanSignals = signals.map(sig => {
        const { atrStopBreachDates, atrStopBreachReturns, ...rest } = sig
        return rest
      })

      return {
        ticker: row.ticker,
        signals_1y: leanSignals,
        updated_at: new Date().toISOString(),
      }
    })

    const { error: updateError } = await supabase
      .from('daily_signals')
      .upsert(updates, { onConflict: 'ticker' })

    if (updateError) {
      console.error(`Error updating batch at ${batchStart}:`, updateError)
    } else {
      updatedCount += batch.length
      console.log(`  Updated ${Math.min(batchStart + BATCH_SIZE, allSignalRows.length)}/${allSignalRows.length} rows`)
    }
  }

  console.log(`\n✓ Removed ATR fields from ${updatedCount} tickers\n`)

  console.log('==========================================')
  console.log('Migration complete!')
  console.log('==========================================')
  console.log(`ATR breaches extracted:  ${totalBreaches}`)
  console.log(`Tickers updated:         ${updatedCount}`)
  console.log(`\nNext steps:`)
  console.log(`  1. Update chunk size from 10 → 50 in compute-backtest-summary.ts`)
  console.log(`  2. Update compute-backtest-summary.ts to write ATR breaches to new table`)
  console.log(`  3. Update compute-daily-signal-enrichment.ts to read ATR breaches from new table`)
  console.log(`  4. Run: npm run pipeline:daily`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
