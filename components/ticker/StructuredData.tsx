import { BacktestSummary } from '@/lib/backtest-summary'

interface StructuredDataProps {
  ticker: string
  data: BacktestSummary
  spyReturn5y?: number | null
}

export function StructuredData({ ticker, data, spyReturn5y }: StructuredDataProps) {
  const domain = process.env.NEXT_PUBLIC_DOMAIN || 'mlln.ai'
  const tickerLower = ticker.toLowerCase()
  const sectorLabel = data.sector ? data.sector.toLowerCase() : 'growth'
  const spyComparisonText = spyReturn5y != null
    ? `The S&P 500 (SPY) returned approximately ${Math.round(spyReturn5y)}% over the same period.`
    : `The S&P 500 (SPY) has historically delivered more moderate, broad-market returns over the same period.`
  const outperformed5y = data.alpha5y >= 0
  const alphaMagnitude5y = Math.abs(Math.round(data.alpha5y))
  const lessCapital5y = data.enhInvested5y <= data.stdInvested5y

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `https://${domain}/asset/${tickerLower}`,
        name: `${ticker} DCA Backtest Results`,
        description: `Dollar cost averaging backtest for ${ticker} over 1, 3, and 5 years`,
        url: `https://${domain}/asset/${tickerLower}`,
        inLanguage: 'en-US',
        dateModified: data.updated_at,
        author: {
          '@type': 'Person',
          name: 'Thanvir Chowdhury',
          jobTitle: 'Former Director, S&P Global',
          affiliation: { '@type': 'Organization', name: 'Phycomex' },
        },
      },

      {
        '@type': 'FinancialProduct',
        name: `Enhanced DCA Strategy for ${ticker}`,
        description:
          `An intelligent dollar cost averaging strategy for ${ticker} that buys ` +
          `more during market dips and less during overbought conditions.`,
        feesAndCommissionsSpecification: 'No management fees. Subscription from $29/mo.',
      },

      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How much would I have if I DCA'd $100/week into ${ticker} for 5 years?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Dollar cost averaging $100 per week into ${ticker} for 5 years ` +
                `(${Math.round(data.stdPurchases5y)} purchases) would have resulted in a total investment ` +
                `of $${Math.round(data.stdInvested5y).toLocaleString()} and a current value of ` +
                `$${Math.round(data.stdValue5y).toLocaleString()}, a return of ${Math.round(data.stdReturn5y)}%. ` +
                `Using Enhanced DCA, which concentrates buys during dips, the same ` +
                `$100/week base deployed $${Math.round(data.enhInvested5y).toLocaleString()} and ` +
                `grew to $${Math.round(data.enhValue5y).toLocaleString()} — a ${Math.round(data.enhReturn5y)}% return.`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the best DCA strategy for ${ticker}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Backtesting shows Enhanced DCA — which increases buy amounts during ` +
                `market dips and reduces or skips buys when ${ticker} is overextended — ` +
                `${outperformed5y ? 'outperformed' : 'underperformed'} standard weekly DCA by ${alphaMagnitude5y}% over 5 years. ` +
                `The enhanced strategy achieved a ${Math.round(data.enhReturn5y)}% return vs ` +
                `${Math.round(data.stdReturn5y)}% for standard DCA.`,
            },
          },
          {
            '@type': 'Question',
            name: `What would $100/week into ${ticker} be worth after 3 years?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Investing $100 per week into ${ticker} for 3 years (${Math.round(data.stdPurchases3y)} purchases, ` +
                `$${Math.round(data.stdInvested3y).toLocaleString()} total) would have grown to ` +
                `$${Math.round(data.stdValue3y).toLocaleString()} — a ${Math.round(data.stdReturn3y)}% return. ` +
                `Enhanced DCA over the same period returned ${Math.round(data.enhReturn3y)}%.`,
            },
          },
          {
            '@type': 'Question',
            name: `Is DCA into ${ticker} worth it?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Based on a 5-year backtest, DCA into ${ticker} returned ${Math.round(data.stdReturn5y)}% ` +
                `with standard weekly purchases. An intelligent DCA strategy that buys more ` +
                `during dips returned ${Math.round(data.enhReturn5y)}% over the same period — ` +
                `a ${alphaMagnitude5y}% ${outperformed5y ? 'gain' : 'shortfall'} in return, ${lessCapital5y ? 'while deploying a similar or smaller amount of capital' : 'while deploying more capital'}.`,
            },
          },
          {
            '@type': 'Question',
            name: `How many shares of ${ticker} would I have after DCA for 5 years?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Dollar cost averaging $100/week into ${ticker} for 5 years would result in ` +
                `approximately ${Math.round(data.stdShares5y)} shares with a standard DCA approach ` +
                `(avg entry $${Math.round(data.stdAvgEntry5y)}). Enhanced DCA targeting dips results in ` +
                `${Math.round(data.enhShares5y)} shares at an average entry of $${Math.round(data.enhAvgEntry5y)}.`,
            },
          },
          {
            '@type': 'Question',
            name: `How does ${ticker} DCA compare to the S&P 500?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Enhanced DCA into ${ticker} returned ${Math.round(data.enhReturn5y)}% over the past 5 years. ` +
                `${spyComparisonText} ${ticker}'s performance reflects its volatility as a ${sectorLabel} ` +
                `asset. Enhanced DCA ` +
                `${outperformed5y ? `outperformed standard DCA by ${alphaMagnitude5y}%, demonstrating the value of intelligent entry timing during market dips` : `underperformed standard DCA by ${alphaMagnitude5y}% over this period, showing signal-based timing doesn't always beat regular-interval buying`}.`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the risk of dollar cost averaging into ${ticker}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Past backtest performance does not guarantee future results. ${ticker} is a ` +
                `${sectorLabel} asset whose price can fall as well as rise. While ` +
                `DCA reduces timing risk by spreading purchases over time, losses are still possible if the price ` +
                `declines significantly. Always invest within your risk tolerance and consider your overall portfolio diversification.`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the ${data.name} dollar cost averaging strategy?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Standard DCA invests a fixed amount ($100/week or $433/month) into ${ticker} at regular intervals. ` +
                `Enhanced DCA improves on this by using RSI (Relative Strength Index) signals to increase buy amounts ` +
                `during market dips (oversold conditions) and reduce or skip purchases when the stock is overextended. ` +
                `Over the 5-year backtest, this timing approach has delivered ${alphaMagnitude5y}% ${outperformed5y ? 'higher' : 'lower'} returns than standard ` +
                `DCA while deploying ${lessCapital5y ? 'less' : 'more'} total capital into ${ticker}.`,
            },
          },
        ],
      },

      {
        '@type': 'Dataset',
        name: `${ticker} DCA Backtest Dataset`,
        description:
          `Historical backtest results for dollar cost averaging into ${ticker} ` +
          `over 1, 3, and 5 year periods, comparing standard vs enhanced DCA strategies.`,
        creator: { '@type': 'Organization', name: 'mlln.ai' },
        temporalCoverage: `${data.backtest_start_year}/${new Date().getFullYear()}`,
        dateModified: data.updated_at,
        variableMeasured: [
          'Total return %',
          'Capital deployed',
          'Portfolio value',
          'Number of purchases',
          'Average entry price',
          'Alpha vs standard DCA',
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
