'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Window = '1y' | '3y' | '5y';
type Freq = 'weekly' | 'monthly';

interface WindowMetrics {
  std: number | null;
  enh: number | null;
  enhAlpha: number | null;
  macro: number | null;
  macroAlpha: number | null;
}

export interface CompareRow {
  ticker: string;
  name: string;
  sector: string;
  assetType: string | null;
  dcaScore: number | null;
  weekly: Record<Window, WindowMetrics>;
  monthly: Record<Window, WindowMetrics>;
}

type SortColumn = 'ticker' | 'sector' | 'std' | 'enh' | 'enhAlpha' | 'macro' | 'macroAlpha';

function fmt(n: number | null): string {
  if (n === null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function color(n: number | null): string {
  if (n === null) return 'var(--text-2)';
  return n >= 0 ? 'var(--green)' : '#E24B4A';
}

function WinRateBadge({ wins, total }: { wins: number; total: number }) {
  if (total === 0) return null;
  const pct = (wins / total) * 100;
  const good = pct >= 50;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '13px', fontWeight: '700',
      fontFamily: 'DM Mono, monospace', padding: '3px 9px', borderRadius: '6px',
      background: good ? 'var(--green-dim, rgba(40,217,126,0.14))' : 'rgba(226,75,74,0.14)',
      color: good ? 'var(--green)' : '#E24B4A',
    }}>
      {pct.toFixed(0)}%
    </span>
  );
}

export function CompareTable({ rows }: { rows: CompareRow[] }) {
  const [window, setWindow] = useState<Window>('1y');
  const [freq, setFreq] = useState<Freq>('weekly');
  const [sectorFilter, setSectorFilter] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<'' | 'stock' | 'etf'>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('macroAlpha');
  const [sortDesc, setSortDesc] = useState(true);

  const uniqueSectors = useMemo(
    () => Array.from(new Set(rows.map(r => r.sector).filter(Boolean))).sort(),
    [rows]
  );

  const metricsOf = (r: CompareRow): WindowMetrics => r[freq][window];

  const filtered = useMemo(() => {
    let f = sectorFilter ? rows.filter(r => r.sector === sectorFilter) : rows;
    if (assetTypeFilter) f = f.filter(r => r.assetType === assetTypeFilter);
    const sorted = [...f].sort((a, b) => {
      const ma = metricsOf(a), mb = metricsOf(b);
      let va: string | number | null, vb: string | number | null;
      switch (sortColumn) {
        case 'ticker': va = a.ticker; vb = b.ticker; break;
        case 'sector': va = a.sector; vb = b.sector; break;
        case 'std': va = ma.std; vb = mb.std; break;
        case 'enh': va = ma.enh; vb = mb.enh; break;
        case 'enhAlpha': va = ma.enhAlpha; vb = mb.enhAlpha; break;
        case 'macro': va = ma.macro; vb = mb.macro; break;
        case 'macroAlpha': va = ma.macroAlpha; vb = mb.macroAlpha; break;
      }
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'string') return sortDesc ? (vb as string).localeCompare(va) : va.localeCompare(vb as string);
      return sortDesc ? (vb as number) - va : va - (vb as number);
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sectorFilter, assetTypeFilter, sortColumn, sortDesc, window, freq]);

  // Summary stats over the filtered set
  const summary = useMemo(() => {
    const enhAlphas = filtered.map(r => metricsOf(r).enhAlpha).filter((n): n is number => n !== null);
    const macroAlphas = filtered.map(r => metricsOf(r).macroAlpha).filter((n): n is number => n !== null);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const wins = (arr: number[]) => arr.filter(n => n > 0).length;
    return {
      avgEnhAlpha: avg(enhAlphas),
      avgMacroAlpha: avg(macroAlphas),
      enhWins: wins(enhAlphas),
      enhTotal: enhAlphas.length,
      macroWins: wins(macroAlphas),
      macroTotal: macroAlphas.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, window, freq]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) setSortDesc(!sortDesc);
    else { setSortColumn(col); setSortDesc(true); }
  };

  const ToggleGroup = <T extends string>({ value, options, onChange }: { value: T; options: Array<{ key: T; label: string }>; onChange: (v: T) => void }) => (
    <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '5px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: 'none',
            background: value === key ? 'var(--teal)' : 'transparent',
            color: value === key ? '#040e18' : 'var(--text-2)',
            fontWeight: value === key ? 600 : 500,
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const SortHeader = ({ column, label, align = 'right' }: { column: SortColumn; label: string; align?: 'left' | 'right' }) => {
    const isActive = sortColumn === column;
    return (
      <th
        onClick={() => handleSort(column)}
        style={{ padding: '12px 16px', textAlign: align, fontWeight: '600', color: isActive ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
      >
        {label}{isActive ? (sortDesc ? ' ↓' : ' ↑') : ''}
      </th>
    );
  };

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Window</span>
          <ToggleGroup value={window} onChange={setWindow} options={[{ key: '1y', label: '1 Year' }, { key: '3y', label: '3 Years' }, { key: '5y', label: '5 Years' }]} />
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Frequency</span>
          <ToggleGroup value={freq} onChange={setFreq} options={[{ key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' }]} />
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Type</span>
          <ToggleGroup value={assetTypeFilter} onChange={setAssetTypeFilter} options={[{ key: '', label: 'All' }, { key: 'stock', label: 'Stocks' }, { key: 'etf', label: 'ETFs' }]} />
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sector</span>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="mlln-pill"
            style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border-elevated)', borderRadius: '8px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-xs)' }}
          >
            <option value="">All Sectors</option>
            {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
            Avg Signal-Enhanced Alpha
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: color(summary.avgEnhAlpha) }}>
            {fmt(summary.avgEnhAlpha)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <WinRateBadge wins={summary.enhWins} total={summary.enhTotal} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>
              beats standard on {summary.enhWins}/{summary.enhTotal} assets
            </span>
          </div>
        </div>
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
            Avg Macro-Scaled Alpha
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: color(summary.avgMacroAlpha) }}>
            {fmt(summary.avgMacroAlpha)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <WinRateBadge wins={summary.macroWins} total={summary.macroTotal} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>
              beats standard on {summary.macroWins}/{summary.macroTotal} assets
            </span>
          </div>
        </div>
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
            Assets Compared
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
            {filtered.length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-elevated)', borderRadius: '12px', background: 'var(--surface-elevated)', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <SortHeader column="ticker" label="Asset" align="left" />
              <SortHeader column="sector" label="Sector" align="left" />
              <SortHeader column="std" label="Standard" />
              <SortHeader column="enh" label="Signal-Enhanced" />
              <SortHeader column="enhAlpha" label="Enh Alpha" />
              <SortHeader column="macro" label="Macro-Scaled" />
              <SortHeader column="macroAlpha" label="Macro Alpha" />
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Best Model</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => {
              const m = metricsOf(row);
              const best =
                m.enhAlpha === null && m.macroAlpha === null ? '—'
                : (m.enhAlpha ?? -Infinity) <= 0 && (m.macroAlpha ?? -Infinity) <= 0 ? 'Standard'
                : (m.enhAlpha ?? -Infinity) >= (m.macroAlpha ?? -Infinity) ? 'Enhanced' : 'Macro';
              return (
                <tr key={row.ticker} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text)' }}>
                    <Link href={`/asset/${row.ticker.toLowerCase()}`} style={{ color: 'var(--teal)', textDecoration: 'none', cursor: 'pointer' }} className="hover:underline">
                      {row.ticker}
                    </Link>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{row.name}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.sector}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: color(m.std) }}>{fmt(m.std)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: color(m.enh) }}>{fmt(m.enh)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: '600', color: color(m.enhAlpha) }}>{fmt(m.enhAlpha)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: color(m.macro) }}>{fmt(m.macro)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: '600', color: color(m.macroAlpha) }}>{fmt(m.macroAlpha)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                      background: best === 'Enhanced' ? 'var(--teal-dim, rgba(0,196,167,0.12))' : best === 'Macro' ? 'var(--green-dim, rgba(40,217,126,0.12))' : 'var(--surface2)',
                      color: best === 'Enhanced' ? 'var(--teal)' : best === 'Macro' ? 'var(--green)' : 'var(--text-2)',
                    }}>
                      {best}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
