'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { NumberTicker } from '@/components/ui/NumberTicker';
import { useAppStore } from '@/store/appStore';
import type { BacktestData } from '@/lib/signalCalculations';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { Period } from '@/types';
import type { BacktestSummary } from '@/lib/backtest-summary';

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: '1y', label: '1 Year' },
  { key: '3y', label: '3 Years' },
  { key: '5y', label: '5 Years' },
];

const YEARS_REQUIRED: Record<Period, number> = { '1y': 1, '3y': 3, '5y': 5 };
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

interface CustomBacktestTilesProps {
  isUserAuthenticated: boolean;
  ticker?: string;
  backtestSummary?: BacktestSummary;
  /** When provided, the Model toggle switches tiles between backtestSummary (enhanced) and this (macro). */
  macroSummary?: BacktestSummary | null;
  backtestData?: BacktestData;
}

export function CustomBacktestTiles({ isUserAuthenticated, ticker, backtestSummary: enhancedSummary, macroSummary, backtestData }: CustomBacktestTilesProps) {
  const { frequency, baseAmount, backtestModel, macroFactorEnabled, macroVolEnabled, macroMeanReversionEnabled } = useAppStore();

  // Factor Tilt (PCA), Volatility Timing (EWMA), and Mean Reversion (AR(1)/OU) default to the
  // precomputed "all on" baseline in macroSummary - no fetch until a toggle (set in
  // BacktestSettings) deviates from that.
  const [liveMacroFields, setLiveMacroFields] = useState<Record<string, number> | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);

  useEffect(() => {
    if (!ticker || !macroSummary) return;
    if (macroFactorEnabled && macroVolEnabled && macroMeanReversionEnabled) {
      setLiveMacroFields(null); // all on = the precomputed baseline already in macroSummary
      return;
    }
    let cancelled = false;
    setLoadingLive(true);
    fetch(`/api/asset/${ticker}/macro-backtest?factor=${macroFactorEnabled ? 1 : 0}&vol=${macroVolEnabled ? 1 : 0}&meanReversion=${macroMeanReversionEnabled ? 1 : 0}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`macro-backtest API error: ${res.status}`)))
      .then(fields => { if (!cancelled) setLiveMacroFields(fields); })
      .catch(err => console.error('Error fetching live macro backtest:', err))
      .finally(() => { if (!cancelled) setLoadingLive(false); });
    return () => { cancelled = true; };
  }, [ticker, macroSummary, macroFactorEnabled, macroVolEnabled, macroMeanReversionEnabled]);

  const effectiveMacroSummary = liveMacroFields && macroSummary ? { ...macroSummary, ...liveMacroFields } : macroSummary;
  const usingMacro = backtestModel === 'macro' && !!effectiveMacroSummary;
  const backtestSummary = usingMacro ? effectiveMacroSummary : enhancedSummary;
  const modelLabel = usingMacro ? 'Macro' : 'Enhanced';

  const getRealData = (period: Period) => {
    if (!backtestSummary) return null;

    // Recently-listed tickers (e.g. IPOs) don't have real 3Y/5Y history — the backtest
    // window silently falls back to whatever's available, which is the same underlying
    // data as 1Y. Hide those periods rather than show a duplicate mislabeled as multi-year.
    const yearsRequired = YEARS_REQUIRED[period];
    if (yearsRequired > 1 && backtestSummary.backtest_start_date) {
      const yearsOfHistory = (Date.now() - new Date(backtestSummary.backtest_start_date).getTime()) / MS_PER_YEAR;
      if (yearsOfHistory < yearsRequired) return null;
    }

    const getField = (fieldName: keyof BacktestSummary): number => {
      const val = backtestSummary[fieldName];
      return typeof val === 'number' ? val : 0;
    };

    if (frequency === 'weekly') {
      const periodKey = period as '1y' | '3y' | '5y';
      const scaledInvestedStd = getField(`stdInvested${periodKey}` as keyof BacktestSummary) * (baseAmount / 100);
      const scaledValueStd = getField(`stdValue${periodKey}` as keyof BacktestSummary) * (baseAmount / 100);
      const scaledInvestedEnh = getField(`enhInvested${periodKey}` as keyof BacktestSummary) * (baseAmount / 100);
      const scaledValueEnh = getField(`enhValue${periodKey}` as keyof BacktestSummary) * (baseAmount / 100);

      return {
        stdInvested: scaledInvestedStd,
        stdValue: scaledValueStd,
        stdReturn: getField(`stdReturn${periodKey}` as keyof BacktestSummary),
        stdBuys: getField(`stdPurchases${periodKey}` as keyof BacktestSummary),
        stdAvgEntry: getField(`stdAvgEntry${periodKey}` as keyof BacktestSummary),
        enhInvested: scaledInvestedEnh,
        enhValue: scaledValueEnh,
        enhReturn: getField(`enhReturn${periodKey}` as keyof BacktestSummary),
        enhBuys: getField(`enhPurchases${periodKey}` as keyof BacktestSummary),
        enhAvgEntry: getField(`enhAvgEntry${periodKey}` as keyof BacktestSummary),
        enhSkipped: 0,
        alpha: getField(`alpha${periodKey}` as keyof BacktestSummary),
      };
    } else {
      // Monthly frequency
      const periodKey = period as '1y' | '3y' | '5y';
      const monthlyAmount = Math.round(baseAmount * 4.33);

      const scaledInvestedStd = getField(`monthlyStdInvested${periodKey}` as keyof BacktestSummary) * (monthlyAmount / 433);
      const scaledValueStd = getField(`monthlyStdValue${periodKey}` as keyof BacktestSummary) * (monthlyAmount / 433);
      const scaledInvestedEnh = getField(`monthlyEnhInvested${periodKey}` as keyof BacktestSummary) * (monthlyAmount / 433);
      const scaledValueEnh = getField(`monthlyEnhValue${periodKey}` as keyof BacktestSummary) * (monthlyAmount / 433);

      return {
        stdInvested: scaledInvestedStd,
        stdValue: scaledValueStd,
        stdReturn: getField(`monthlyStdReturn${periodKey}` as keyof BacktestSummary),
        stdBuys: getField(`monthlyStdPurchases${periodKey}` as keyof BacktestSummary),
        stdAvgEntry: getField(`monthlyStdAvgEntry${periodKey}` as keyof BacktestSummary),
        enhInvested: scaledInvestedEnh,
        enhValue: scaledValueEnh,
        enhReturn: getField(`monthlyEnhReturn${periodKey}` as keyof BacktestSummary),
        enhBuys: getField(`monthlyEnhPurchases${periodKey}` as keyof BacktestSummary),
        enhAvgEntry: getField(`monthlyEnhAvgEntry${periodKey}` as keyof BacktestSummary),
        enhSkipped: getField(`monthlySkipped${periodKey}` as keyof BacktestSummary),
        alpha: getField(`monthlyAlpha${periodKey}` as keyof BacktestSummary),
      };
    }
  };

  const displayAmt = frequency === 'monthly' ? Math.round(baseAmount * 4.33) : baseAmount;

  return (
    <div style={{ marginTop: '12px', opacity: usingMacro && loadingLive ? 0.6 : 1, transition: 'opacity 0.15s' }}>
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
                      {modelLabel}
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
