'use client';

import { useState } from 'react';
import { formatPercent, formatCurrency } from '@/lib/formatters';

interface ConfigVariant {
  rsiLevel1: number;
  rsiLevel2: number;
  rsiLevel3: number;
  rsiLevel4: number;
  buyPercent1: number;
  buyPercent2: number;
  buyPercent3: number;
  buyPercent4: number;
}

interface BacktestResult {
  ticker: string;
  name: string;
  variants: {
    current: BacktestMetrics;
    conservative: BacktestMetrics;
    balanced: BacktestMetrics;
    aggressive: BacktestMetrics;
  };
}

interface BacktestMetrics {
  return1y: number;
  return3y: number;
  return5y: number;
  invested1y: number;
  invested3y: number;
  invested5y: number;
  value1y: number;
  value3y: number;
  value5y: number;
  alpha1y: number;
  alpha3y: number;
  alpha5y: number;
}

const DEFAULT_CONFIGS: Record<string, ConfigVariant> = {
  current: {
    rsiLevel1: 35,
    rsiLevel2: 45,
    rsiLevel3: 50,
    rsiLevel4: 55,
    buyPercent1: 400,
    buyPercent2: 150,
    buyPercent3: 50,
    buyPercent4: 0,
  },
  conservative: {
    rsiLevel1: 35,
    rsiLevel2: 40,
    rsiLevel3: 45,
    rsiLevel4: 50,
    buyPercent1: 400,
    buyPercent2: 250,
    buyPercent3: 150,
    buyPercent4: 0,
  },
  balanced: {
    rsiLevel1: 35,
    rsiLevel2: 40,
    rsiLevel3: 45,
    rsiLevel4: 50,
    buyPercent1: 400,
    buyPercent2: 200,
    buyPercent3: 100,
    buyPercent4: 0,
  },
  aggressive: {
    rsiLevel1: 35,
    rsiLevel2: 39,
    rsiLevel3: 44,
    rsiLevel4: 50,
    buyPercent1: 400,
    buyPercent2: 300,
    buyPercent3: 200,
    buyPercent4: 100,
  },
};

const VARIANT_NAMES: Record<string, string> = {
  current: 'Current',
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

const VARIANT_COLORS: Record<string, string> = {
  current: '#999',
  conservative: '#0066cc',
  balanced: 'var(--teal)',
  aggressive: '#ff6600',
};

function ConfigPanel({ variant, config, onConfigChange }: {
  variant: string;
  config: ConfigVariant;
  onConfigChange: (variant: string, key: keyof ConfigVariant, value: number) => void;
}) {
  return (
    <div style={{
      flex: 1,
      padding: '16px',
      background: 'var(--surface-elevated)',
      border: `1px solid var(--border-elevated)`,
      borderRadius: '12px',
      minWidth: '200px'
    }}>
      <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: VARIANT_COLORS[variant], marginBottom: '12px' }}>
        {VARIANT_NAMES[variant]}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
          RSI Levels
        </div>
        {[1, 2, 3, 4].map((level) => {
          const key = `rsiLevel${level}` as keyof ConfigVariant;
          return (
            <div key={key} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '2px' }}>
                Level {level}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min="20"
                  max="70"
                  value={config[key]}
                  onChange={(e) => onConfigChange(variant, key, Number(e.target.value))}
                  style={{ flex: 1, height: '4px' }}
                />
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', minWidth: '28px', textAlign: 'right' }}>
                  {config[key]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
          Buy Percents
        </div>
        {[1, 2, 3, 4].map((level) => {
          const key = `buyPercent${level}` as keyof ConfigVariant;
          return (
            <div key={key} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '2px' }}>
                P{level}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min="0"
                  max="700"
                  step="50"
                  value={config[key]}
                  onChange={(e) => onConfigChange(variant, key, Number(e.target.value))}
                  style={{ flex: 1, height: '4px' }}
                />
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', minWidth: '45px', textAlign: 'right' }}>
                  {config[key]}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EtfConfigComparisonPage() {
  const [configs, setConfigs] = useState<Record<string, ConfigVariant>>(DEFAULT_CONFIGS);
  const [testMode, setTestMode] = useState<'sample' | 'all'>('sample');
  const [results, setResults] = useState<BacktestResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'1y' | '3y' | '5y'>('5y');

  const handleConfigChange = (variant: string, key: keyof ConfigVariant, value: number) => {
    setConfigs(prev => ({
      ...prev,
      [variant]: {
        ...prev[variant],
        [key]: value
      }
    }));
  };

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/admin/backtest-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configs,
          testMode,
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run backtest');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          ETF Config Comparison
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>
          Adjust RSI levels and buy percentages for each variant, then run a backtest to compare results.
        </p>

        {/* Config Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {Object.keys(DEFAULT_CONFIGS).map(variant => (
            <ConfigPanel
              key={variant}
              variant={variant}
              config={configs[variant]}
              onConfigChange={handleConfigChange}
            />
          ))}
        </div>

        {/* Test Mode & Run Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase' }}>
              Test Mode:
            </span>
            <div style={{ display: 'flex', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '8px', padding: '2px' }}>
              {(['sample', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTestMode(mode)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: 'none',
                    background: testMode === mode ? 'var(--teal)' : 'transparent',
                    color: testMode === mode ? '#040e18' : 'var(--text-2)',
                    fontWeight: testMode === mode ? 600 : 500,
                    transition: 'all 0.15s'
                  }}
                >
                  {mode === 'sample' ? '5 Sample ETFs' : 'All 60 ETFs'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: 'var(--teal)',
              color: '#040e18',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s'
            }}
          >
            {loading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#ff3333', color: 'white', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Results Stats & Table */}
        {results && results.length > 0 && (
          <>
            {/* Summary Stats */}
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {Object.keys(DEFAULT_CONFIGS).map(variant => {
                const avgReturn = results.reduce((sum, r) => sum + (r.variants[variant as keyof typeof results[0]['variants']][`return${selectedPeriod}` as keyof BacktestMetrics] as number), 0) / results.length;
                const wins = results.filter(r => (r.variants[variant as keyof typeof results[0]['variants']][`return${selectedPeriod}` as keyof BacktestMetrics] as number) > (r.variants.current[`return${selectedPeriod}` as keyof BacktestMetrics] as number)).length;

                return (
                  <div key={variant}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: VARIANT_COLORS[variant], textTransform: 'uppercase', marginBottom: '6px' }}>
                      {VARIANT_NAMES[variant]}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>
                      {formatPercent(avgReturn)} avg return
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                      {wins} / {results.length} beat current
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table */}
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Timeframe Selector */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
              {(['1y', '3y', '5y'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  style={{
                    padding: '6px 12px',
                    background: selectedPeriod === period ? 'var(--teal)' : 'var(--bg)',
                    color: selectedPeriod === period ? '#040e18' : 'var(--text-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: selectedPeriod === period ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th
                      onClick={() => setSortBy(sortBy?.column === 'ticker' ? { column: 'ticker', direction: sortBy.direction === 'asc' ? 'desc' : 'asc' } : { column: 'ticker', direction: 'asc' })}
                      style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em', cursor: 'pointer' }}>
                      Asset {sortBy?.column === 'ticker' ? (sortBy.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    {Object.keys(DEFAULT_CONFIGS).map(variant => (
                      <th key={variant} style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: VARIANT_COLORS[variant], textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em', cursor: 'pointer' }}
                        onClick={() => setSortBy(sortBy?.column === variant ? { column: variant, direction: sortBy.direction === 'asc' ? 'desc' : 'asc' } : { column: variant, direction: 'desc' })}
                      >
                        {VARIANT_NAMES[variant]} {sortBy?.column === variant ? (sortBy.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let sorted = [...results];
                    if (sortBy) {
                      sorted.sort((a, b) => {
                        let aVal: number, bVal: number;
                        if (sortBy.column === 'ticker') {
                          aVal = a.ticker.localeCompare(b.ticker) as any;
                          bVal = 0;
                        } else {
                          const aMetrics = a.variants[sortBy.column as keyof typeof a.variants];
                          const bMetrics = b.variants[sortBy.column as keyof typeof b.variants];
                          aVal = aMetrics[`return${selectedPeriod}` as keyof typeof aMetrics] as number;
                          bVal = bMetrics[`return${selectedPeriod}` as keyof typeof bMetrics] as number;
                        }
                        return sortBy.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
                      });
                    }
                    return sorted.map((result, idx) => (
                      <tr key={result.ticker} style={{ borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600' }}>{result.ticker}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>{result.name}</div>
                        </td>
                        {Object.keys(DEFAULT_CONFIGS).map(variant => {
                          const metrics = result.variants[variant as keyof typeof result.variants];
                          const returnKey = `return${selectedPeriod}` as keyof typeof metrics;
                          const investedKey = `invested${selectedPeriod}` as keyof typeof metrics;
                          const alphaKey = `alpha${selectedPeriod}` as keyof typeof metrics;
                          const returnVal = metrics[returnKey] as number;
                          const investedVal = metrics[investedKey] as number;
                          const alphaVal = metrics[alphaKey] as number;

                          return (
                            <td key={variant} style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <div style={{ fontWeight: '600', color: returnVal >= 0 ? 'var(--green)' : '#ff3333', marginBottom: '2px' }}>
                                {formatPercent(returnVal)}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '4px' }}>
                                {alphaVal >= 0 ? '+' : ''}{formatPercent(alphaVal)} α
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                                Inv: {formatCurrency(investedVal)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            </div>
          </>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
            <div style={{ fontSize: '14px', marginBottom: '12px' }}>Computing backtests...</div>
            <div style={{ fontSize: '12px' }}>
              {testMode === 'sample' ? 'Testing on 5 sample ETFs (~90 seconds)' : 'Testing on all 60 ETFs (~30-40 minutes)'}
            </div>
          </div>
        )}

        {!results && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '13px' }}>
            Adjust the config variants above and click "Run Backtest" to compare results.
          </div>
        )}
      </div>
    </div>
  );
}
