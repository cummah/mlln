/**
 * run-weekly-pipeline.ts
 *
 * Chains the weekly signal pipeline (lower-frequency updates).
 * All steps run sequentially with dependencies.
 *
 * Order:
 *   1. compute:factor-model — recalibrate PCA factor loadings
 *   2. compute:scores — compute DCA suitability scores per asset
 *   3. update:macro-regime — update macro regime state
 *   4. compute:weekly-enrichment — enrich weekly signals with technical metrics + bonuses
 *   5. compute:monthly-enrichment — enrich monthly signals with technical metrics + bonuses
 *
 * Daily updates (price backfill, signals, enrichment) run separately via pipeline:daily
 *
 * Usage:
 *   npm run pipeline:weekly                      # Full run
 *   npm run pipeline:weekly -- --from=compute:scores  # Resume from a specific step
 */

import { spawnSync } from 'child_process'

const STEPS: { name: string; script: string; args?: string }[] = [
  { name: 'compute:factor-model', script: 'compute:factor-model', args: '--incremental' },
  { name: 'compute:scores', script: 'compute:scores' },
  { name: 'update:macro-regime', script: 'update:macro-regime' },
  { name: 'compute:weekly-enrichment', script: 'compute:weekly-enrichment' },
  { name: 'compute:monthly-enrichment', script: 'compute:monthly-enrichment' },
]

const fromArg = process.argv.find(arg => arg.startsWith('--from='))
const fromStep = fromArg?.split('=')[1]

const startIndex = fromStep ? STEPS.findIndex(s => s.name === fromStep) : 0

if (fromStep && startIndex === -1) {
  console.error(`Unknown step "${fromStep}". Valid steps: ${STEPS.map(s => s.name).join(', ')}`)
  process.exit(1)
}

const stepsToRun = STEPS.slice(startIndex)
const pipelineStart = Date.now()

// Run all steps sequentially
for (const step of stepsToRun) {
  console.log(`\n=== ${step.name} ===`)
  const stepStart = Date.now()
  const args = ['run', step.script]
  if (step.args) args.push('--', step.args)
  const result = spawnSync('npm', args, { stdio: 'inherit', shell: true })
  const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)

  if (result.status !== 0) {
    console.error(`\n✗ ${step.name} failed after ${elapsed}s (exit code ${result.status}).`)
    console.error(`  Fix the error above, then resume with: npm run pipeline:weekly -- --from=${step.name}`)
    process.exit(result.status ?? 1)
  }

  console.log(`✓ ${step.name} done in ${elapsed}s`)
}

console.log(`\nWeekly pipeline complete in ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s`)
