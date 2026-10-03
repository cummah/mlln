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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  return res.text()
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null
  s = s.trim().replace(/,/g, '')
  if (s === '-' || s === '' || s === 'N/A' || s === 'NaN') return null
  const pct = s.endsWith('%')
  const n = parseFloat(pct ? s.slice(0, -1) : s)
  if (Number.isNaN(n)) return null
  return pct ? n / 100 : n
}

function parseSvelteTable(html: string): Record<string, string> {
  const map: Record<string, string> = {}
  const labelRe = /<div class="[^"]*\btruncate\b[^"]*"[^>]*>([^<]+)<\/div>[\s\S]{0,3000}?<\/td>((?:(?:<!--[^>]*-->)*<td[^>]*>[^<]*<\/td>)+)/g
  const valueTdRe = /<td[^>]*>([^<]*)<\/td>/
  let m: RegExpExecArray | null
  while ((m = labelRe.exec(html))) {
    const label = m[1].trim()
    const firstVal = m[2].match(valueTdRe)
    if (firstVal && !(label in map)) map[label] = firstVal[1].trim()
  }
  return map
}

function parseCompanyPage(html: string): { sector?: string; industry?: string; website?: string; description?: string } {
  const result: Record<string, string> = {}

  const descStart = html.indexOf('Company Description</h1>')
  if (descStart !== -1) {
    const blockEnd = html.indexOf('</div></div>', descStart)
    const block = html.slice(descStart, blockEnd)
    const paras = [...block.matchAll(/<p>([^<]*)<\/p>/g)].map(m => m[1])
    result.description = paras.join(' ')
  }

  const kvRe = /<td[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([^<]+)<\/td>\s*<td[^>]*class="[^"]*text-right[^"]*"[^>]*>(?:(?:<!--[^>]*-->)*<a[^>]*>)?([^<]*)/g
  let m: RegExpExecArray | null
  while ((m = kvRe.exec(html))) {
    result[m[1].trim()] = m[2].trim()
  }

  return {
    sector: result['Sector'],
    industry: result['Industry'],
    website: result['Website'],
    description: result.description,
  }
}

interface FundamentalsUpdate {
  ticker: string
  sector?: string | null
  industry?: string | null
  website?: string | null
  long_business_summary?: string | null
  revenue?: number | null
  revenue_growth?: number | null
  eps_growth?: number | null
  net_income_growth?: number | null
  debt_to_equity?: number | null
  current_ratio?: number | null
  roe?: number | null
}

async function scrapeTicker(ticker: string): Promise<FundamentalsUpdate | null> {
  const slug = ticker.toLowerCase()

  const companyHtml = await fetchPage(`https://stockanalysis.com/stocks/${slug}/company/`)
  if (!companyHtml) return null
  const company = parseCompanyPage(companyHtml)
  await delay(300)

  const incomeHtml = await fetchPage(`https://stockanalysis.com/stocks/${slug}/financials/`)
  const income = incomeHtml ? parseSvelteTable(incomeHtml) : {}
  await delay(300)

  const ratiosHtml = await fetchPage(`https://stockanalysis.com/stocks/${slug}/financials/ratios/`)
  const ratios = ratiosHtml ? parseSvelteTable(ratiosHtml) : {}
  await delay(300)

  return {
    ticker,
    sector: company.sector ?? null,
    industry: company.industry ?? null,
    website: company.website ?? null,
    long_business_summary: company.description ?? null,
    revenue: parseNum(income['Revenue']) != null ? Math.round(parseNum(income['Revenue'])! * 1e6) : null,
    revenue_growth: parseNum(income['Revenue Growth']),
    eps_growth: parseNum(income['EPS Growth']),
    net_income_growth: parseNum(income['Net Income Growth']),
    debt_to_equity: parseNum(ratios['Debt / Equity Ratio']),
    current_ratio: parseNum(ratios['Current Ratio']),
    roe: parseNum(ratios['Return on Equity (ROE)']),
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const tickersArg = process.argv.find(arg => arg.startsWith('--tickers='))
  let tickers: string[]

  if (tickersArg) {
    tickers = tickersArg.split('=')[1].split(',').map(t => t.trim())
  } else {
    tickers = []
    const pageSize = 1000
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('assets')
        .select('ticker')
        .eq('asset_type', 'stock')
        .eq('is_active', true)
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) {
        console.error(error)
        process.exit(1)
      }
      tickers.push(...(data as any[]).map(a => a.ticker))
      if (!data || data.length < pageSize) break
    }
  }

  console.log(`Scraping fundamentals for ${tickers.length} tickers\n`)

  let processed = 0
  let updated = 0
  const failed: Array<{ ticker: string; error: string }> = []

  for (const ticker of tickers) {
    try {
      const result = await scrapeTicker(ticker)
      if (!result) {
        failed.push({ ticker, error: 'company page fetch failed' })
      } else {
        const { ticker: t, ...fields } = result
        const { error } = await supabase.from('assets').update(fields).eq('ticker', t)
        if (error) {
          failed.push({ ticker, error: error.message })
        } else {
          updated++
        }
      }
    } catch (err) {
      failed.push({ ticker, error: err instanceof Error ? err.message : String(err) })
    }

    processed++
    if (processed % 20 === 0 || processed === tickers.length) {
      console.log(`Progress: ${processed}/${tickers.length} (${updated} updated, ${failed.length} failed)`)
    }
  }

  console.log('\n==========================================')
  console.log('       SCRAPE FUNDAMENTALS SUMMARY')
  console.log('==========================================')
  console.log(`Total processed: ${processed}/${tickers.length}`)
  console.log(`Updated:         ${updated}`)
  console.log(`Failed:          ${failed.length}`)
  if (failed.length > 0) {
    console.log('\nFailed tickers:')
    for (const { ticker, error } of failed.slice(0, 50)) {
      console.log(`  - ${ticker}: ${error}`)
    }
    fs.writeFileSync(
      path.resolve(__dirname, '../fundamentals-failed.json'),
      JSON.stringify(failed, null, 2)
    )
  }
}

main()
