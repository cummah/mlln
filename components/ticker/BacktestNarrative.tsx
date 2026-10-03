'use client'

import { useState } from 'react'
import { BacktestSummary } from '@/lib/backtest-summary'
import { formatSignedPercent } from '@/lib/formatters'

interface BacktestNarrativeProps {
  ticker: string
  name: string
  data: BacktestSummary
  sector?: string
  spyReturn5y?: number | null
}

export function BacktestNarrative({ ticker, name, data, sector, spyReturn5y }: BacktestNarrativeProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly')

  return (
    <section aria-label="Backtest summary" style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-elevated)',
      borderRadius: '14px',
      overflow: 'hidden',
      boxShadow: 'var(--inset-top), var(--shadow-md)'
    }}>
      {/* Header with Tabs */}
      <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '3px', height: '36px', borderRadius: '2px', background: 'var(--teal)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>
              Backtest analysis
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', letterSpacing: '-0.3px', margin: 0 }}>
              Dollar cost averaging into {ticker} — backtest results
            </h2>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'weekly', label: 'Weekly DCA ($100/week)' },
            { id: 'monthly', label: 'Monthly DCA ($433/month)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'weekly' | 'monthly')}
              style={{
                padding: '5px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--surface2)' : 'transparent',
                border: activeTab === tab.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-2)',
                transition: 'all 0.15s',
                fontFamily: 'DM Sans, sans-serif'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 28px' }}>
        {activeTab === 'weekly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
            <div style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: '1.75', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>
                Investing <strong style={{ color: 'var(--text)' }}>$100/week into {ticker} ({name})</strong> using standard
                dollar cost averaging over the past 5 years would have resulted in a total investment of{' '}
                <strong style={{ color: 'var(--text)' }}>${Math.round(data.stdInvested5y).toLocaleString()}</strong> across{' '}
                <strong style={{ color: 'var(--text)' }}>{Math.round(data.stdPurchases5y)} purchases</strong>, growing to a current value of{' '}
                <strong style={{ color: 'var(--text)' }}>${Math.round(data.stdValue5y).toLocaleString()}</strong> — a return of{' '}
                <strong style={{ color: 'var(--green)' }}>{Math.round(data.stdReturn5y)}%</strong>.
              </p>
              <p>
                Using <strong style={{ color: 'var(--text)' }}>Enhanced DCA</strong> — which automatically buys more when multiple signals agree conditions are right, and holds back when they don't —{" "}<a href="/methodology/enhanced-dca" style={{color: "var(--teal)", textDecoration: "underline"}}>See the full methodology</a>{"."}
                {" "}The same $100/week base deployed{' '}
                <strong style={{ color: 'var(--teal)' }}>${Math.round(data.enhInvested5y).toLocaleString()}</strong> across{' '}
                <strong style={{ color: 'var(--teal)' }}>{Math.round(data.enhPurchases5y)} targeted purchases</strong>, growing to{' '}
                <strong style={{ color: 'var(--teal)' }}>${Math.round(data.enhValue5y).toLocaleString()}</strong>. That's a return of{' '}
                <strong style={{ color: 'var(--teal)' }}>{Math.round(data.enhReturn5y)}%</strong> — <strong style={{ color: 'var(--teal)' }}>{formatSignedPercent(data.alpha5y, 0)} {data.alpha5y >= 0 ? 'more' : 'less'}</strong> than
                standard DCA, with {data.enhAvgEntry5y <= data.stdAvgEntry5y ? 'a lower' : 'a higher'} average entry price of{' '}
                <strong style={{ color: 'var(--teal)' }}>${Math.round(data.enhAvgEntry5y)} vs ${Math.round(data.stdAvgEntry5y)}</strong>.
              </p>
              {spyReturn5y != null && (
                <p>
                  Over the same 5-year period, the S&P 500 returned approximately <strong style={{ color: 'var(--text)' }}>{Math.round(spyReturn5y)}%</strong>, demonstrating that {ticker}'s
                  <strong style={{ color: 'var(--teal)' }}> {Math.round(data.enhReturn5y)}% return</strong> reflects its higher volatility and growth potential as a {sector ? sector.toLowerCase() : 'growth'} stock.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { period: '1-year', weekly: `$${Math.round(data.stdInvested1y).toLocaleString()} → $${Math.round(data.stdValue1y).toLocaleString()}`, enhWeekly: `$${Math.round(data.enhInvested1y).toLocaleString()} → $${Math.round(data.enhValue1y).toLocaleString()}`, ret: `${Math.round(data.stdReturn1y)}%`, enhRet: `${Math.round(data.enhReturn1y)}%` },
                { period: '3-year', weekly: `$${Math.round(data.stdInvested3y).toLocaleString()} → $${Math.round(data.stdValue3y).toLocaleString()}`, enhWeekly: `$${Math.round(data.enhInvested3y).toLocaleString()} → $${Math.round(data.enhValue3y).toLocaleString()}`, ret: `${Math.round(data.stdReturn3y)}%`, enhRet: `${Math.round(data.enhReturn3y)}%` },
                { period: '5-year', weekly: `$${Math.round(data.stdInvested5y).toLocaleString()} → $${Math.round(data.stdValue5y).toLocaleString()}`, enhWeekly: `$${Math.round(data.enhInvested5y).toLocaleString()} → $${Math.round(data.enhValue5y).toLocaleString()}`, ret: `${Math.round(data.stdReturn5y)}%`, enhRet: `${Math.round(data.enhReturn5y)}%` },
              ].map(r => (
                <div key={r.period} style={{ background: 'var(--surface2-elevated)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-elevated)', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--teal)', marginBottom: '6px' }}>
                    {r.period} weekly DCA results
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--text)', fontWeight: '600' }}>Standard: </span>{r.weekly} · <span style={{ color: 'var(--green)' }}>{r.ret}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--text)', fontWeight: '600' }}>Enhanced: </span>{r.enhWeekly} · <span style={{ color: 'var(--green)' }}>{r.enhRet}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'monthly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
            <div style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: '1.75', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>
                Investing <strong style={{ color: 'var(--text)' }}>$433/month into {ticker} ({name})</strong> using standard
                dollar cost averaging over the past 5 years would have resulted in a total investment of{' '}
                <strong style={{ color: 'var(--text)' }}>${Math.round(data.monthlyStdInvested5y).toLocaleString()}</strong> growing to{' '}
                <strong style={{ color: 'var(--text)' }}>${Math.round(data.monthlyStdValue5y).toLocaleString()}</strong> — a return of{' '}
                <strong style={{ color: 'var(--green)' }}>{Math.round(data.monthlyStdReturn5y)}%</strong>.
              </p>
              <p>
                Using <strong style={{ color: 'var(--text)' }}>Enhanced DCA</strong> — which automatically buys more when multiple signals agree conditions are right, and holds back when they don't — the same $433/month base deployed{' '}
                <strong style={{ color: 'var(--teal)' }}>${Math.round(data.monthlyEnhInvested5y).toLocaleString()}</strong> across targeted purchases, growing to{' '}
                <strong style={{ color: 'var(--teal)' }}>${Math.round(data.monthlyEnhValue5y).toLocaleString()}</strong>. That's a return of{' '}
                <strong style={{ color: 'var(--teal)' }}>{Math.round(data.monthlyEnhReturn5y)}%</strong> — <strong style={{ color: 'var(--teal)' }}>{formatSignedPercent(data.monthlyAlpha5y, 0)} {data.monthlyAlpha5y >= 0 ? 'more' : 'less'}</strong> than
                standard monthly DCA.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { period: '1-year', monthly: `$${Math.round(data.monthlyStdInvested1y).toLocaleString()} → $${Math.round(data.monthlyStdValue1y).toLocaleString()}`, enhMonthly: `$${Math.round(data.monthlyEnhInvested1y).toLocaleString()} → $${Math.round(data.monthlyEnhValue1y).toLocaleString()}`, ret: `${Math.round(data.monthlyStdReturn1y)}%`, enhRet: `${Math.round(data.monthlyEnhReturn1y)}%` },
                { period: '3-year', monthly: `$${Math.round(data.monthlyStdInvested3y).toLocaleString()} → $${Math.round(data.monthlyStdValue3y).toLocaleString()}`, enhMonthly: `$${Math.round(data.monthlyEnhInvested3y).toLocaleString()} → $${Math.round(data.monthlyEnhValue3y).toLocaleString()}`, ret: `${Math.round(data.monthlyStdReturn3y)}%`, enhRet: `${Math.round(data.monthlyEnhReturn3y)}%` },
                { period: '5-year', monthly: `$${Math.round(data.monthlyStdInvested5y).toLocaleString()} → $${Math.round(data.monthlyStdValue5y).toLocaleString()}`, enhMonthly: `$${Math.round(data.monthlyEnhInvested5y).toLocaleString()} → $${Math.round(data.monthlyEnhValue5y).toLocaleString()}`, ret: `${Math.round(data.monthlyStdReturn5y)}%`, enhRet: `${Math.round(data.monthlyEnhReturn5y)}%` },
              ].map(r => (
                <div key={r.period} style={{ background: 'var(--surface2-elevated)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-elevated)', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--teal)', marginBottom: '6px' }}>
                    {r.period} monthly DCA results
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--text)', fontWeight: '600' }}>Standard: </span>{r.monthly} · <span style={{ color: 'var(--green)' }}>{r.ret}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--text)', fontWeight: '600' }}>Enhanced: </span>{r.enhMonthly} · <span style={{ color: 'var(--green)' }}>{r.enhRet}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
