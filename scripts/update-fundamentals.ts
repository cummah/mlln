/**
 * update-fundamentals.ts
 *
 * Fetches fundamental data from Yahoo Finance for assets
 * Generates thematic tags using Anthropic Claude API from longBusinessSummary
 * Updates the assets table with fundamentals and tags
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/update-fundamentals.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: number
  ticker: string
  long_business_summary?: string
  tags?: string[] | null
}

interface YahooFundamentals {
  industry?: string
  website?: string
  longBusinessSummary?: string
  marketCap?: number
  beta?: number
  trailingPE?: number
  dividendYield?: number
  profitMargins?: number
  enterpriseValue?: number
  enterpriseToEbitda?: number
  enterpriseToRevenue?: number
  roic?: number
  grossProfits?: number
  operatingCashflow?: number
}

// ─── Fetch Yahoo Finance Data via yfinance ────────────────────────────────────

async function fetchYahooFundamentals(ticker: string): Promise<YahooFundamentals> {
  try {
    const pythonScript = path.resolve(__dirname, 'fetch-fundamentals.py')
    const output = execSync(`python "${pythonScript}" ${ticker}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const data = JSON.parse(output)

    if (data.error) {
      console.warn(`yfinance error for ${ticker}: ${data.error}`)
      return {}
    }

    return {
      industry: data.industry,
      website: undefined,
      longBusinessSummary: data.longBusinessSummary,
      marketCap: data.marketCap,
      beta: data.beta,
      trailingPE: data.trailingPE,
      dividendYield: undefined,
      profitMargins: data.profitMargins,
      enterpriseValue: data.enterpriseValue,
      enterpriseToEbitda: data.enterpriseToEbitda,
      enterpriseToRevenue: data.enterpriseToRevenue,
      roic: data.returnOnAssets,
      grossProfits: data.grossProfits,
      operatingCashflow: data.operatingCashflow,
    }
  } catch (error) {
    console.warn(`Error fetching fundamentals for ${ticker}:`, error)
    return {}
  }
}

// ─── Generate Tags via Claude ─────────────────────────────────────────────────

async function generateTags(
  ticker: string,
  industry: string | undefined,
  businessSummary: string | undefined
): Promise<string[]> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set, skipping tag generation')
    return []
  }

  if (!businessSummary || businessSummary.length < 50) {
    console.warn(`Skipping tag generation for ${ticker}: insufficient business summary`)
    return []
  }

  try {
    const prompt = `You are a financial analyst. Given the following company information, generate 3-5 specific thematic tags that describe the company's business model and sector positioning.

Industry: ${industry || 'Unknown'}
Business Summary: ${businessSummary}

Return ONLY a valid JSON array of lowercase string tags, no explanation. Example: ["ai-chips", "fabless", "data-center"]

Tags should be:
- Lowercase, hyphenated (no spaces)
- Specific to the business model or competitive advantage
- Useful for portfolio filtering

Return only the JSON array, nothing else.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Claude API error for ${ticker}:`,
        response.status,
        errorText
      )
      return []
    }

    const data: any = await response.json()
    const content = data.content?.[0]?.text || ''

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn(`No valid JSON array in Claude response for ${ticker}`)
      return []
    }

    const tags = JSON.parse(jsonMatch[0])
    if (!Array.isArray(tags)) {
      console.warn(`Claude returned non-array for ${ticker}`)
      return []
    }

    return tags.filter((t) => typeof t === 'string')
  } catch (error) {
    console.error(`Error generating tags for ${ticker}:`, error)
    return []
  }
}

// ─── Update Asset in Database ─────────────────────────────────────────────────

async function updateAssetFundamentals(
  asset: Asset,
  fundamentals: YahooFundamentals,
  tags: string[]
): Promise<void> {
  try {
    // Calculate gross profitability
    let grossProfitability: number | null = null
    if (fundamentals.grossProfits && fundamentals.marketCap) {
      grossProfitability = fundamentals.grossProfits / fundamentals.marketCap
    }

    // Calculate EV/FCF (assuming FCF ≈ Operating Cash Flow)
    let evFcf: number | null = null
    if (fundamentals.enterpriseValue && fundamentals.operatingCashflow) {
      evFcf = fundamentals.enterpriseValue / fundamentals.operatingCashflow
    }

    // Update asset with fundamentals and tags
    const { error } = await supabase
      .from('assets')
      .update({
        roic: fundamentals.roic || null,
        gross_profitability: grossProfitability || null,
        ev_ebitda: fundamentals.enterpriseToEbitda || null,
        ev_fcf: evFcf || null,
        operating_cash_flow: fundamentals.operatingCashflow || null,
        beta: fundamentals.beta || null,
        tags: tags.length > 0 ? tags : null,
        fundamentals_last_updated: new Date().toISOString(),
      })
      .eq('id', asset.id)

    if (error) {
      console.error(`Failed to update ${asset.ticker}: ${error.message}`)
    } else {
      console.log(
        `✓ ${asset.ticker}: ${tags.length > 0 ? `tags: ${tags.join(', ')}` : 'no tags'}`
      )
    }
  } catch (error) {
    console.error(`Error updating fundamentals for ${asset.ticker}:`, error)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Starting fundamentals update...')

    // Fetch all active assets (paginated — Supabase caps a single select at 1000 rows)
    const assets: Asset[] = []
    const PAGE_SIZE = 1000
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('assets')
        .select('id, ticker, tags')
        .eq('is_active', true)
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        throw new Error(`Failed to fetch assets: ${error.message}`)
      }
      if (!page || page.length === 0) break
      assets.push(...(page as Asset[]))
      if (page.length < PAGE_SIZE) break
    }

    if (!assets || assets.length === 0) {
      console.log('No assets to update')
      return
    }

    console.log(`Updating ${assets.length} assets...`)

    let updated = 0
    let failed = 0

    for (const asset of assets) {
      try {
        // Fetch fundamentals from Yahoo Finance
        const fundamentals = await fetchYahooFundamentals(asset.ticker)

        // Skip Claude tag regeneration for assets that already have tags —
        // this run only needs to refresh the numeric fundamentals + timestamp.
        const existingTags = Array.isArray(asset.tags) && asset.tags.length > 0 ? asset.tags : null
        const tags = existingTags ?? await generateTags(
          asset.ticker,
          fundamentals.industry,
          fundamentals.longBusinessSummary
        )

        // Update database
        await updateAssetFundamentals(asset, fundamentals, tags)

        updated++

        // Rate limiting: 1 request per 500ms to be respectful to APIs
        await new Promise((r) => setTimeout(r, 500))
      } catch (err) {
        console.error(`Error processing ${asset.ticker}:`, err)
        failed++
      }
    }

    console.log(
      `\nCompleted: ${updated} updated, ${failed} failed out of ${assets.length}`
    )
  } catch (error) {
    console.error('Error updating fundamentals:', error)
    process.exit(1)
  }
}

main()
