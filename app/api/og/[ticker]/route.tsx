import { ImageResponse } from 'next/og'
import { getBacktestSummary } from '@/lib/backtest-summary'

export async function GET(
  req: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const data = await getBacktestSummary(params.ticker)

    if (!data) {
      return new Response('Not Found', { status: 404 })
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            background: '#0f0f0f',
            display: 'flex',
            flexDirection: 'column',
            padding: '60px',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <div style={{ fontSize: 18, color: '#9c9a92', marginBottom: 8 }}>
            Dollar Cost Averaging Backtest
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 500,
              color: '#f0ede6',
              marginBottom: 4,
            }}
          >
            {params.ticker.toUpperCase()}
          </div>
          <div style={{ fontSize: 22, color: '#9c9a92', marginBottom: 48 }}>
            {data.name}
          </div>

          {/* Key numbers */}
          <div style={{ display: 'flex', gap: 48 }}>
            <div>
              <div style={{ fontSize: 14, color: '#6b6b67' }}>Enhanced DCA · 5Y</div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 500,
                  color: '#1D9E75',
                }}
              >
                +{Math.round(data.enhReturn5y)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#6b6b67' }}>Standard DCA · 5Y</div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 500,
                  color: '#9c9a92',
                }}
              >
                +{Math.round(data.stdReturn5y)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#6b6b67' }}>Alpha advantage</div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 500,
                  color: '#378ADD',
                }}
              >
                +{Math.round(data.alpha5y)}%
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              fontSize: 16,
              color: '#6b6b67',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>$100/week · Weekly · 5 year backtest</span>
            <span>mlln.ai</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch (err) {
    console.error('Error generating OG image:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
