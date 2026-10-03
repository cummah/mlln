'use client'

import { useState } from 'react'
import { BacktestSummary } from '@/lib/backtest-summary'
import { ChevronDown } from 'lucide-react'

interface FAQSectionProps {
  ticker: string
  name: string
  data: BacktestSummary
  sector?: string
  spyReturn5y?: number | null
}

export function FAQSection({ ticker, name, data, sector, spyReturn5y }: FAQSectionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const spyComparisonSentence = spyReturn5y != null
    ? `The S&P 500 (SPY) returned approximately ${Math.round(spyReturn5y)}% over the same period.`
    : `The S&P 500 (SPY) has historically delivered more moderate, broad-market returns over the same period.`

  const outperformed5y = data.alpha5y >= 0
  const alphaMagnitude5y = Math.abs(Math.round(data.alpha5y))
  const lessCapital5y = data.enhInvested5y <= data.stdInvested5y

  const faqs = [
    {
      q: `How much would I have if I DCA'd $100/week into ${ticker} for 5 years?`,
      a: `$100/week into ${ticker} for 5 years would be worth $${Math.round(data.stdValue5y).toLocaleString()}
        with standard DCA (${Math.round(data.stdReturn5y)}% return). Enhanced DCA targeting dips
        would have grown to $${Math.round(data.enhValue5y).toLocaleString()} (${Math.round(data.enhReturn5y)}% return).
        Monthly investing of $433/month would have returned ${Math.round(data.monthlyStdReturn5y)}% standard DCA
        vs ${Math.round(data.monthlyEnhReturn5y)}% Enhanced DCA.`,
    },
    {
      q: `What is the best DCA strategy for ${ticker}?`,
      a: `Backtesting ${ticker} shows Enhanced DCA ${outperformed5y ? 'outperformed' : 'underperformed'} standard weekly DCA
        by ${alphaMagnitude5y}% over 5 years by concentrating buys when multiple signals agree
        conditions are right, and holding back when they don't.`,
    },
    {
      q: `Is weekly or monthly DCA better for ${ticker}?`,
      a: `Over 5 years, Enhanced DCA with weekly $100 purchases returned ${Math.round(data.enhReturn5y)}%,
        while monthly $433 purchases (equivalent capital) returned ${Math.round(data.monthlyEnhReturn5y)}% Enhanced DCA.
        Weekly typically captures more entry opportunities due to finer-grained timing during volatility,
        but monthly requires less maintenance. Both benefit significantly from Enhanced DCA's signal-based approach.`,
    },
    {
      q: `How many shares of ${ticker} would I have after 5 years of DCA?`,
      a: `DCA of $100/week into ${ticker} for 5 years results in approximately
        ${Math.round(data.stdShares5y)} shares at an average price of $${Math.round(data.stdAvgEntry5y)}.
        Enhanced DCA achieves ${Math.round(data.enhShares5y)} shares at $${Math.round(data.enhAvgEntry5y)} average entry.`,
    },
    {
      q: `Is DCA into ${ticker} worth it?`,
      a: `Based on 5-year backtest data, standard DCA into ${ticker} returned ${Math.round(data.stdReturn5y)}%.
        Enhanced DCA returned ${Math.round(data.enhReturn5y)}%
        while deploying $${Math.round(data.enhInvested5y).toLocaleString()} vs $${Math.round(data.stdInvested5y).toLocaleString()}
        in standard DCA — a ${alphaMagnitude5y}% ${outperformed5y ? 'gain' : 'shortfall'} in return, ${lessCapital5y ? 'with less capital deployed' : 'despite deploying more capital'}.`,
    },
    {
      q: `How does ${ticker} DCA compare to the S&P 500?`,
      a: `Enhanced DCA into ${ticker} returned ${Math.round(data.enhReturn5y)}% over the past 5 years.
        ${spyComparisonSentence} ${ticker}'s performance reflects its higher volatility as a ${sector ? sector.toLowerCase() : 'growth'} stock.
        Enhanced DCA ${outperformed5y ? `outperformed standard DCA by ${alphaMagnitude5y}%, demonstrating the value of timing entries during market dips` : `underperformed standard DCA by ${alphaMagnitude5y}% over this period, showing signal-based timing doesn't always beat buying at regular intervals`}.`,
    },
    {
      q: `What is the risk of dollar cost averaging into ${ticker}?`,
      a: `Past backtest performance does not guarantee future results. ${ticker} is a high-volatility
        ${sector ? sector.toLowerCase() : 'growth'} stock, meaning it typically experiences larger
        price swings than the broader market. While DCA reduces timing risk by spreading purchases
        over time, losses are still possible if the stock declines significantly. Always invest
        within your risk tolerance and consider your overall portfolio diversification.`,
    },
    {
      q: `What is the ${name} dollar cost averaging strategy?`,
      a: `Standard DCA invests a fixed amount ($100/week or $433/month) into ${ticker} at regular intervals.
        Enhanced DCA improves on this by automatically buying more when multiple signals agree conditions are right,
        and holding back when they don't. Over the 5-year backtest, this timing approach has ${outperformed5y ? `delivered ${alphaMagnitude5y}% higher returns` : `delivered ${alphaMagnitude5y}% lower returns`}
        than standard DCA while deploying ${lessCapital5y ? 'less' : 'more'} total capital into ${ticker}.`,
    },
  ]

  return (
    <section aria-label="Frequently asked questions" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: '700' }}>
        Frequently asked questions
      </div>

      <div>
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            style={{ borderBottom: idx < faqs.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <button
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: '13.5px',
                fontWeight: '500',
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'var(--teal)'}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'}
            >
              <span>{faq.q}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  flexShrink: 0,
                  color: 'var(--text-2)',
                  transition: 'transform 0.2s',
                  transform: openIdx === idx ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {openIdx === idx && (
              <div style={{ padding: '0 20px 14px', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.65' }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
