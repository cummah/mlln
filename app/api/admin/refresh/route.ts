import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

interface ProcessResult {
  stdout: string
  stderr: string
  exitCode: number | null
  time: number
}

async function spawnProcess(command: string, args: string[], cwd: string): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const process = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    let stdout = ''
    let stderr = ''

    process.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      const time = Date.now() - startTime
      resolve({ stdout, stderr, exitCode: code, time })
    })

    process.on('error', (err) => {
      const time = Date.now() - startTime
      resolve({ stdout, stderr: err.message, exitCode: 1, time })
    })
  })
}

function parseBackfillOutput(output: string): { tickers: number; rows: number } {
  // Extract from: "Total tickers processed:   369/369" and "Total rows upserted:       484370"
  const tickersMatch = output.match(/Total tickers processed:\s+(\d+)/)
  const rowsMatch = output.match(/Total rows upserted:\s+(\d+)/)

  return {
    tickers: tickersMatch ? parseInt(tickersMatch[1]) : 0,
    rows: rowsMatch ? parseInt(rowsMatch[1]) : 0,
  }
}

function parseCacheOutput(output: string): { tickers: number } {
  // Extract from: "Tickers with data:         713"
  const tickersMatch = output.match(/Tickers with data:\s+(\d+)/)
  return {
    tickers: tickersMatch ? parseInt(tickersMatch[1]) : 0,
  }
}

function parseSummaryOutput(output: string): { tickers: number; rows: number } {
  // Extract from: "✓ Successfully processed:    123" and "✓ Rows upserted:             456"
  const tickersMatch = output.match(/Successfully processed:\s+(\d+)/)
  const rowsMatch = output.match(/Rows upserted:\s+(\d+)/)
  return {
    tickers: tickersMatch ? parseInt(tickersMatch[1]) : 0,
    rows: rowsMatch ? parseInt(rowsMatch[1]) : 0,
  }
}

function parseScoresOutput(output: string): { tickers: number } {
  // Extract from compute:scores output
  const tickersMatch = output.match(/Successfully processed:\s+(\d+)/) || output.match(/Processed:\s+(\d+)/)
  return {
    tickers: tickersMatch ? parseInt(tickersMatch[1]) : 0,
  }
}

export async function POST(request: Request) {
  try {
    // 1. Validate secret key
    const { searchParams } = new URL(request.url)
    const providedKey = searchParams.get('key')
    const secretKey = process.env.REFRESH_SECRET_KEY

    if (!secretKey) {
      console.error('REFRESH_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Admin endpoint not configured' },
        { status: 500 }
      )
    }

    if (!providedKey || providedKey !== secretKey) {
      return NextResponse.json(
        { error: 'Invalid or missing secret key' },
        { status: 401 }
      )
    }

    console.log('Admin refresh initiated at', new Date().toISOString())
    const projectRoot = path.resolve(process.cwd())

    // 2. Run backfill:prices
    console.log('Starting backfill:prices...')
    const backfillResult = await spawnProcess(
      'npm',
      ['run', 'backfill:missing'],
      projectRoot
    )

    if (backfillResult.exitCode !== 0) {
      console.error('backfill:missing failed:', backfillResult.stderr)
    }

    const backfillStats = parseBackfillOutput(backfillResult.stdout)
    const backfillTimeMs = backfillResult.time

    console.log(`Backfill completed in ${backfillTimeMs}ms:`, backfillStats)

    // 3. Run compute:summary
    console.log('Starting compute:summary...')
    const summaryResult = await spawnProcess(
      'npm',
      ['run', 'compute:summary'],
      projectRoot
    )

    if (summaryResult.exitCode !== 0) {
      console.error('compute:summary failed:', summaryResult.stderr)
    }

    const summaryStats = parseSummaryOutput(summaryResult.stdout)
    const summaryTimeMs = summaryResult.time

    console.log(`Compute summary completed in ${summaryTimeMs}ms:`, summaryStats)

    // 4. Run compute:scores (updates dca_suitability_score)
    console.log('Starting compute:scores...')
    const scoresResult = await spawnProcess(
      'npm',
      ['run', 'compute:scores'],
      projectRoot
    )

    if (scoresResult.exitCode !== 0) {
      console.error('compute:scores failed:', scoresResult.stderr)
    }

    const scoresStats = parseScoresOutput(scoresResult.stdout)
    const scoresTimeMs = scoresResult.time

    console.log(`Compute scores completed in ${scoresTimeMs}ms:`, scoresStats)

    // 5. Return results
    const response = {
      status: 'success',
      timestamp: new Date().toISOString(),
      backfill: {
        tickers: backfillStats.tickers,
        rows: backfillStats.rows,
        time: `${(backfillTimeMs / 1000).toFixed(2)}s`,
      },
      summary: {
        tickers: summaryStats.tickers,
        rows: summaryStats.rows,
        time: `${(summaryTimeMs / 1000).toFixed(2)}s`,
      },
      scores: {
        tickers: scoresStats.tickers,
        time: `${(scoresTimeMs / 1000).toFixed(2)}s`,
      },
    }

    console.log('Admin refresh completed successfully')
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in admin refresh:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
