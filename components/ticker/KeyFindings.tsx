import { BacktestSummary } from '@/lib/backtest-summary'
import { formatSignedPercent } from '@/lib/formatters'

interface KeyFindingsProps {
  ticker: string
  name: string
  data: BacktestSummary
}

export function KeyFindings({ ticker, name, data }: KeyFindingsProps) {
  return (
    <section aria-label="Key findings" className="rs-pad" style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-elevated)',
      borderRadius: '14px',
      padding: '24px 28px',
      boxShadow: 'var(--inset-top), var(--shadow-md)'
    }}>
      <h3 style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px 0' }}>
        {ticker} DCA Results: Key Findings
      </h3>
      <div className="rs-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Left Column: Text Content */}
        <div style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.75', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0 }}>
            Investing <strong style={{ color: 'var(--text)' }}>$100 per week into {name}</strong> ({ticker}) using Enhanced DCA over the past 5 years resulted in a total investment of{' '}
            <strong style={{ color: 'var(--text)' }}>${Math.round(data.enhInvested5y).toLocaleString()}</strong>, growing to a current value of{' '}
            <strong style={{ color: 'var(--teal)' }}>${Math.round(data.enhValue5y).toLocaleString()}</strong> — a return of{' '}
            <strong style={{ color: 'var(--teal)' }}>{Math.round(data.enhReturn5y)}%</strong>.
          </p>
          <p style={{ margin: 0 }}>
            Standard dollar cost averaging over the same period returned{' '}
            <strong style={{ color: 'var(--green)' }}>{Math.round(data.stdReturn5y)}%</strong>, making Enhanced DCA{' '}
            <strong style={{ color: 'var(--teal)' }}>{formatSignedPercent(data.alpha5y, 0)} {data.alpha5y >= 0 ? 'more' : 'less'} effective</strong> with{' '}
            {data.enhAvgEntry5y <= data.stdAvgEntry5y ? 'a lower' : 'a higher'} average entry price of{' '}
            <strong style={{ color: 'var(--teal)' }}>${Math.round(data.enhAvgEntry5y)}</strong> versus standard DCA's{' '}
            <strong style={{ color: 'var(--text-2)' }}>${Math.round(data.stdAvgEntry5y)}</strong>.
          </p>
        </div>

        {/* Right Column: Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <caption style={{ fontSize: '13px', fontWeight: '600', padding: '0 0 12px 0', textAlign: 'left', color: 'var(--text-2)' }}>
            {ticker} DCA backtest results: standard vs enhanced
          </caption>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: '600' }}>Period</th>
              <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-2)', fontWeight: '600' }}>Standard DCA</th>
              <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--teal)', fontWeight: '600' }}>Enhanced DCA</th>
              <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-2)', fontWeight: '600' }}>Alpha</th>
            </tr>
          </thead>
          <tbody>
            {[
              { period: '1-Year', std: `${Math.round(data.stdReturn1y)}%`, enh: `${Math.round(data.enhReturn1y)}%`, alpha: formatSignedPercent(data.alpha1y, 0) },
              { period: '3-Year', std: `${Math.round(data.stdReturn3y)}%`, enh: `${Math.round(data.enhReturn3y)}%`, alpha: formatSignedPercent(data.alpha3y, 0) },
              { period: '5-Year', std: `${Math.round(data.stdReturn5y)}%`, enh: `${Math.round(data.enhReturn5y)}%`, alpha: formatSignedPercent(data.alpha5y, 0) },
            ].map(row => (
              <tr key={row.period} style={{ borderBottom: '1px solid var(--border)' }}>
                <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text)' }}>{row.period}</th>
                <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-2)' }}>{row.std}</td>
                <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--teal)' }}>{row.enh}</td>
                <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--green)' }}>{row.alpha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
