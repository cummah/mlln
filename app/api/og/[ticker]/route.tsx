import { ImageResponse } from 'next/og'

// The edge runtime is the supported home of ImageResponse. It also cannot use the shared Supabase client,
// so the one row it needs is read straight from the REST API.
export const runtime = 'edge'

const WINDOWS = ['5y', '3y', '1y'] as const
const LABEL = { '5y': '5 year', '3y': '3 year', '1y': '1 year' } as const

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return new Response('Not configured', { status: 500 })

  const cols = ['ticker', 'name', ...WINDOWS.flatMap(w => [`enh_return_${w}`, `std_return_${w}`])].join(',')
  const res = await fetch(`${url}/rest/v1/backtest_summary?select=${cols}&ticker=eq.${encodeURIComponent(tickerUpper)}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return new Response('Data unavailable', { status: 502 })
  const row = ((await res.json()) as Record<string, unknown>[])[0]
  if (!row) return new Response('Not Found', { status: 404 })

  // Longest window that really exists. An asset with no full window shows its name only, never a made up zero.
  const w = WINDOWS.find(x => isNum(row[`enh_return_${x}`]) && isNum(row[`std_return_${x}`]))
  const enh = w ? (row[`enh_return_${w}`] as number) : null
  const std = w ? (row[`std_return_${w}`] as number) : null

  const stat = (label: string, value: string, color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 20, color: '#6b6b67' }}>{label}</div>
      <div style={{ fontSize: 56, fontWeight: 500, color }}>{value}</div>
    </div>
  )

  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', background: '#0f0f0f', display: 'flex', flexDirection: 'column', padding: '60px' }}>
        <div style={{ fontSize: 22, color: '#9c9a92', marginBottom: 8 }}>Dollar Cost Averaging Backtest</div>
        <div style={{ fontSize: 72, fontWeight: 500, color: '#f0ede6', marginBottom: 4 }}>{tickerUpper}</div>
        <div style={{ fontSize: 26, color: '#9c9a92', marginBottom: 48 }}>{String(row.name ?? '')}</div>
        {w && enh !== null && std !== null ? (
          <div style={{ display: 'flex', gap: 56 }}>
            {stat(`Enhanced DCA · ${w.toUpperCase()}`, pct(enh), '#1D9E75')}
            {stat(`Standard DCA · ${w.toUpperCase()}`, pct(std), '#9c9a92')}
            {stat('Difference', `${enh - std >= 0 ? '+' : ''}${(enh - std).toFixed(0)} pts`, '#378ADD')}
          </div>
        ) : (
          <div style={{ fontSize: 28, color: '#9c9a92' }}>Not enough price history for a full backtest yet</div>
        )}
        <div style={{ marginTop: 'auto', fontSize: 20, color: '#6b6b67', display: 'flex', justifyContent: 'space-between' }}>
          <span>{w ? `$100/week · ${LABEL[w]} backtest` : '$100/week backtest'}</span>
          <span>mlln.ai</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
