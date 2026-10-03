/**
 * run-daily-pipeline.ts
 *
 * Chains the full daily signal pipeline in dependency order. Steps 1-8 run
 * sequentially. Steps 9-11 (enrichment) run in parallel after step 8 completes,
 * since they read independent data (daily_signals, backtest_signals, macro_signal_components).
 * Parallel enrichments save ~3-5 min per run.
 *
 * Order:
 *   1-8. prices -> backtest summary -> dca scores -> factor model -> macro backtest ->
 *        macro regime + conviction scores (sequential, dependency chain)
 *   9-11. signal enrichment (daily/weekly/monthly run in parallel, independent reads)
 *
 * Usage:
 *   npm run pipeline:daily                      # Full run: all 1937 tickers
 *   npm run pipeline:daily -- --incremental    # Fast run: only tickers with new prices (~10 min vs ~30-40 min)
 *   npm run pipeline:daily -- --from=compute:scores  # Resume from a specific step
 */

import { spawnSync, spawn } from 'child_process'

const SEQUENTIAL_STEPS: { name: string; script: string }[] = [
  { name: 'backfill:prices', script: 'backfill:prices' },
  { name: 'fill:gaps', script: 'fill:gaps' },
  { name: 'compute:summary', script: 'compute:summary' },
  { name: 'compute:scores', script: 'compute:scores' },
  { name: 'compute:daily-signals', script: 'compute:daily-signals' },
  { name: 'compute:factor-model', script: 'compute:factor-model' },
  { name: 'compute:macro', script: 'compute:macro' },
  { name: 'update:macro-regime', script: 'update:macro-regime' },
  { name: 'compute:conviction-scores', script: 'compute:conviction-scores' },
]

const PARALLEL_STEPS: { name: string; script: string }[] = [
  { name: 'compute:daily-enrichment', script: 'compute:daily-enrichment' },
  { name: 'compute:weekly-enrichment', script: 'compute:weekly-enrichment' },
  { name: 'compute:monthly-enrichment', script: 'compute:monthly-enrichment' },
]

const fromArg = process.argv.find(arg => arg.startsWith('--from='))
const fromStep = fromArg?.split('=')[1]
const incremental = process.argv.includes('--incremental')

// Update compute:summary to use incremental variant if --incremental flag is set
const SEQUENTIAL_STEPS_FINAL = incremental
  ? SEQUENTIAL_STEPS.map(s => s.name === 'compute:summary' ? { ...s, script: 'compute:summary:changed' } : s)
  : SEQUENTIAL_STEPS

const ALL_STEPS = [...SEQUENTIAL_STEPS_FINAL, ...PARALLEL_STEPS]
const startIndex = fromStep ? ALL_STEPS.findIndex(s => s.name === fromStep) : 0

if (fromStep && startIndex === -1) {
  console.error(`Unknown step "${fromStep}". Valid steps: ${ALL_STEPS.map(s => s.name).join(', ')}`)
  process.exit(1)
}

// Determine which steps to run
let stepsToRun = ALL_STEPS.slice(startIndex)
let sequentialStepsToRun = SEQUENTIAL_STEPS_FINAL.slice(Math.max(0, startIndex))
let parallelStepsToRun: typeof PARALLEL_STEPS = []

// If we're resuming partway through, only add parallel steps if we've passed step 8
if (startIndex >= SEQUENTIAL_STEPS_FINAL.length) {
  parallelStepsToRun = PARALLEL_STEPS.slice(Math.max(0, startIndex - SEQUENTIAL_STEPS_FINAL.length))
} else if (startIndex + stepsToRun.length > SEQUENTIAL_STEPS_FINAL.length) {
  // We have some sequential and some parallel steps
  parallelStepsToRun = PARALLEL_STEPS.slice(0, stepsToRun.length - sequentialStepsToRun.length)
}

const pipelineStart = Date.now()

// Run sequential steps
for (const step of sequentialStepsToRun) {
  console.log(`\n=== ${step.name} ===`)
  const stepStart = Date.now()
  const result = spawnSync('npm', ['run', step.script], { stdio: 'inherit', shell: true })
  const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)

  if (result.status !== 0) {
    console.error(`\n✗ ${step.name} failed after ${elapsed}s (exit code ${result.status}).`)
    console.error(`  Fix the error above, then resume with: npm run pipeline:daily -- --from=${step.name}`)
    process.exit(result.status ?? 1)
  }

  console.log(`✓ ${step.name} done in ${elapsed}s`)
}

// Run parallel steps
async function runParallelEnrichment() {
  if (parallelStepsToRun.length === 0) {
    console.log(`\nPipeline complete in ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s`)
    return
  }

  console.log(`\n=== Running enrichment steps in parallel ===`)
  const parallelStart = Date.now()

  const promises = parallelStepsToRun.map(step => {
    return new Promise<{ name: string; status: number; elapsed: string }>((resolve) => {
      console.log(`[PARALLEL] Starting ${step.name}...`)
      const stepStart = Date.now()
      const child = spawn('npm', ['run', step.script], {
        stdio: 'inherit',
        shell: true,
      })

      child.on('close', (code) => {
        const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
        resolve({ name: step.name, status: code ?? 0, elapsed })
      })

      child.on('error', (err) => {
        const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
        console.error(`[PARALLEL] ${step.name} error:`, err)
        resolve({ name: step.name, status: 1, elapsed })
      })
    })
  })

  const results = await Promise.all(promises)
  const parallelElapsed = ((Date.now() - parallelStart) / 1000).toFixed(1)

  const failed = results.filter(r => r.status !== 0)
  if (failed.length > 0) {
    console.error(`\n✗ The following enrichment steps failed:`)
    for (const f of failed) {
      console.error(`  - ${f.name} (exit code ${f.status}, ${f.elapsed}s)`)
    }
    console.error(`  Resume enrichment steps with: npm run pipeline:daily -- --from=compute:daily-enrichment`)
    process.exit(1)
  }

  for (const r of results) {
    console.log(`✓ ${r.name} done in ${r.elapsed}s`)
  }
  console.log(`\nAll enrichment steps done in ${parallelElapsed}s (parallel)`)
  console.log(`\nPipeline complete in ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s`)
}

runParallelEnrichment().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
