'use client';

import { motion } from 'framer-motion';
import { NumberTicker } from '@/components/ui/NumberTicker';
import { useAppStore } from '@/store/appStore';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { Period } from '@/types';
import type { TickerSummary } from '@/lib/ticker/summary';

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: '1y', label: '1 Year' },
  { key: '3y', label: '3 Years' },
  { key: '5y', label: '5 Years' },
];

interface CustomBacktestTilesProps {
  backtestSummary?: TickerSummary | null;
}

export function CustomBacktestTiles({ backtestSummary }: CustomBacktestTilesProps) {
  const { frequency, baseAmount } = useAppStore();

  const getRealData = (period: Period) => {
    if (!backtestSummary) return null;

    // A window the history does not cover is simply not shown. It is never shown as a result.
    if (!backtestSummary.available[frequency][period]) return null;

    const getField = (fieldName: keyof TickerSummary): number => {
      const val = backtestSummary[fieldName];
      return typeof val === 'number' ? val : 0;
    };

    if (frequency === 'weekly') {
      const periodKey = period as '1y' | '3y' | '5y';
      const scaledInvestedStd = getField(`stdInvested${periodKey}` as keyof TickerSummary) * (baseAmount / 100);
      const scaledValueStd = getField(`stdValue${periodKey}` as keyof TickerSummary) * (baseAmount / 100);
      const scaledInvestedEnh = getField(`enhInvested${periodKey}` as keyof TickerSummary) * (baseAmount / 100);
      const scaledValueEnh = getField(`enhValue${periodKey}` as keyof TickerSummary) * (baseAmount / 100);

      return {
        stdInvested: scaledInvestedStd,
        stdValue: scaledValueStd,
        stdReturn: getField(`stdReturn${periodKey}` as keyof TickerSummary),
        stdBuys: getField(`stdPurchases${periodKey}` as keyof TickerSummary),
        stdAvgEntry: getField(`stdAvgEntry${periodKey}` as keyof TickerSummary),
        enhInvested: scaledInvestedEnh,
        enhValue: scaledValueEnh,
        enhReturn: getField(`enhReturn${periodKey}` as keyof TickerSummary),
        enhBuys: getField(`enhPurchases${periodKey}` as keyof TickerSummary),
        enhAvgEntry: getField(`enhAvgEntry${periodKey}` as keyof TickerSummary),
        enhSkipped: getField(`stdPurchases${periodKey}` as keyof TickerSummary) - getField(`enhPurchases${periodKey}` as keyof TickerSummary),
        alpha: getField(`alpha${periodKey}` as keyof TickerSummary),
      };
    } else {
      // Monthly frequency
      const periodKey = period as '1y' | '3y' | '5y';
      const monthlyAmount = Math.round(baseAmount * 4.33);

      const scaledInvestedStd = getField(`monthlyStdInvested${periodKey}` as keyof TickerSummary) * (monthlyAmount / 433);
      const scaledValueStd = getField(`monthlyStdValue${periodKey}` as keyof TickerSummary) * (monthlyAmount / 433);
      const scaledInvestedEnh = getField(`monthlyEnhInvested${periodKey}` as keyof TickerSummary) * (monthlyAmount / 433);
      const scaledValueEnh = getField(`monthlyEnhValue${periodKey}` as keyof TickerSummary) * (monthlyAmount / 433);

      return {
        stdInvested: scaledInvestedStd,
        stdValue: scaledValueStd,
        stdReturn: getField(`monthlyStdReturn${periodKey}` as keyof TickerSummary),
        stdBuys: getField(`monthlyStdPurchases${periodKey}` as keyof TickerSummary),
        stdAvgEntry: getField(`monthlyStdAvgEntry${periodKey}` as keyof TickerSummary),
        enhInvested: scaledInvestedEnh,
        enhValue: scaledValueEnh,
        enhReturn: getField(`monthlyEnhReturn${periodKey}` as keyof TickerSummary),
        enhBuys: getField(`monthlyEnhPurchases${periodKey}` as keyof TickerSummary),
        enhAvgEntry: getField(`monthlyEnhAvgEntry${periodKey}` as keyof TickerSummary),
        enhSkipped: getField(`monthlySkipped${periodKey}` as keyof TickerSummary),
        alpha: getField(`monthlyAlpha${periodKey}` as keyof TickerSummary),
      };
    }
  };

  const displayAmt = frequency === 'monthly' ? Math.round(baseAmount * 4.33) : baseAmount;

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        {PERIODS.map((period, index) => {
          const data = getRealData(period.key);

          if (!data) return null;

          return (
            <motion.div
              key={period.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.06 }}
              className="relative"
            >
              <div style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-elevated)',
                borderRadius: '14px',
                padding: '18px',
                position: 'relative',
                boxShadow: 'var(--inset-top), var(--shadow-md)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                    {period.label}
                  </div>
                  {data.alpha > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: 'var(--green-dim)', color: 'var(--green)' }}>
                      +{formatPercent(data.alpha)} alpha
                    </span>
                  )}
                </div>

                {/* Two Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Standard Column */}
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '8px' }}>
                      Standard
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginBottom: '1px' }}>
                        Invested
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                        <NumberTicker
                          value={data.stdInvested}
                          format={(n) => formatCurrency(n)}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginBottom: '1px' }}>
                        Value
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                        <NumberTicker
                          value={data.stdValue}
                          format={(n) => formatCurrency(n)}
                        />
                      </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginBottom: '1px' }}>
                        Return
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
                        {formatPercent(data.stdReturn)}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Column */}
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--teal)', marginBottom: '8px' }}>
                      Enhanced
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginBottom: '1px' }}>
                        Invested
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'DM Mono, monospace', color: 'var(--teal)' }}>
                        <NumberTicker
                          value={data.enhInvested}
                          format={(n) => formatCurrency(n)}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginBottom: '1px' }}>
                        Value
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'DM Mono, monospace', color: 'var(--teal)' }}>
                        <NumberTicker
                          value={data.enhValue}
                          format={(n) => formatCurrency(n)}
                        />
                      </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginBottom: '1px' }}>
                        Return
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'DM Mono, monospace', color: 'var(--teal)' }}>
                        {formatPercent(data.enhReturn)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '10px', paddingTop: '10px' }}>
                  <strong style={{ color: 'var(--text)' }}>{data.enhBuys}</strong> targeted purchases · avg entry <strong style={{ color: 'var(--text)' }}>${Math.round(data.enhAvgEntry)}</strong>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
