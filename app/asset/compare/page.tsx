import { Metadata } from 'next';
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { CompareTable, type CompareRow } from './CompareTable';

export const metadata: Metadata = {
  title: 'Model Comparison — Signal-Enhanced vs Macro-Scaled | mlln.ai',
  description: 'Compare Standard DCA, Signal-Enhanced DCA, and Macro-Scaled DCA returns side by side across all assets.',
};

export const revalidate = 3600;

async function getCompareRows(): Promise<CompareRow[]> {
  const windows = ['1y', '3y', '5y'] as const;
  const cols = (prefix: string) =>
    windows.flatMap(w => [`${prefix}std_return_${w}`, `${prefix}enh_return_${w}`, `${prefix}alpha_${w}`]).join(', ');

  const [enhanced, macro, assets] = await Promise.all([
    fetchAllPages<any>((from, to) =>
      getSupabaseClient()
        .from('backtest_summary')
        .select(`ticker, name, sector, dca_suitability_score, ${cols('')}, ${cols('monthly_')}`)
        .range(from, to)
    ),
    fetchAllPages<any>((from, to) =>
      getSupabaseClient()
        .from('backtest_summary_macro')
        .select(`ticker, ${cols('')}, ${cols('monthly_')}`)
        .range(from, to)
    ),
    fetchAllPages<any>((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker, asset_type')
        .eq('is_active', true)
        .range(from, to)
    ),
  ]);

  const macroMap = new Map<string, any>();
  macro.forEach(r => macroMap.set(r.ticker, r));

  const assetTypeMap = new Map<string, string>();
  assets.forEach(r => assetTypeMap.set(r.ticker, r.asset_type));

  return enhanced.filter((e: any) => assetTypeMap.has(e.ticker)).map((e: any) => {
    const m = macroMap.get(e.ticker);
    const pick = (row: any, field: string, w: string) => {
      const v = row?.[`${field}_${w}`];
      return typeof v === 'number' ? v : null;
    };
    const windowData = (prefix: string) =>
      Object.fromEntries(windows.map(w => [w, {
        std: pick(e, `${prefix}std_return`, w),
        enh: pick(e, `${prefix}enh_return`, w),
        enhAlpha: pick(e, `${prefix}alpha`, w),
        macro: pick(m, `${prefix}enh_return`, w),
        macroAlpha: pick(m, `${prefix}alpha`, w),
      }]));

    return {
      ticker: e.ticker,
      name: e.name,
      sector: e.sector,
      assetType: assetTypeMap.get(e.ticker) ?? null,
      dcaScore: e.dca_suitability_score ?? null,
      weekly: windowData('') as CompareRow['weekly'],
      monthly: windowData('monthly_') as CompareRow['monthly'],
    };
  });
}

export default async function ComparePage() {
  const rows = await getCompareRows();

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto' }}>
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <a href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
          Assets
        </a>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>Model Comparison</span>
      </nav>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
          Model Comparison
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: '1.6' }}>
          Standard DCA vs Signal-Enhanced vs Macro-Scaled returns across {rows.length} assets.
          Alpha is each model&apos;s return minus standard DCA on the same schedule.
        </p>
      </div>

      <CompareTable rows={rows} />
    </div>
  );
}
