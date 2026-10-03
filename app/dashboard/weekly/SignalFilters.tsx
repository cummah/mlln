'use client';

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  dcaSuitabilityScore: number | null;
}

type ReturnFilter = 'all' | 'positive' | 'negative';
type DateRangeFilter = 'all' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear';

interface SignalFiltersProps {
  data: SignalRow[];
  showOnlyWithSignals: boolean;
  setShowOnlyWithSignals: (value: boolean) => void;
  returnFilter: ReturnFilter;
  setReturnFilter: (value: ReturnFilter) => void;
  dateRangeFilter: DateRangeFilter;
  setDateRangeFilter: (value: DateRangeFilter) => void;
  sectorFilter: string;
  setSectorFilter: (value: string) => void;
  minScoreFilter: number;
  setMinScoreFilter: (value: number) => void;
  minMultiplierFilter: number;
  setMinMultiplierFilter: (value: number) => void;
  baseAmount: number;
  setBaseAmount: (value: number) => void;
}

export function SignalFilters({
  data,
  showOnlyWithSignals,
  setShowOnlyWithSignals,
  returnFilter,
  setReturnFilter,
  dateRangeFilter,
  setDateRangeFilter,
  sectorFilter,
  setSectorFilter,
  minScoreFilter,
  setMinScoreFilter,
  minMultiplierFilter,
  setMinMultiplierFilter,
  baseAmount,
  setBaseAmount,
}: SignalFiltersProps) {
  const uniqueSectors = Array.from(new Set(data.map(r => r.sector).filter(Boolean))).sort();

  const FilterButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        background: active ? 'var(--teal)' : 'var(--surface)',
        border: '1px solid ' + (active ? 'var(--teal)' : 'var(--border)'),
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        color: active ? '#000' : 'var(--text)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface)';
        }
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', marginBottom: '20px' }}>
      {/* Filters Section - 70% - Split into 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>

        {/* Left Sub-Column: Signal, Return, Date Range */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Row 1: Signal Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Signal Filter
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <FilterButton
                active={showOnlyWithSignals}
                onClick={() => setShowOnlyWithSignals(!showOnlyWithSignals)}
                label={showOnlyWithSignals ? '✓ With Signals Only' : 'Show All Assets'}
              />
            </div>
          </div>

          {/* Filter Row 2: Return Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Return Filter
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <FilterButton active={returnFilter === 'all'} onClick={() => setReturnFilter('all')} label="All Returns" />
              <FilterButton active={returnFilter === 'positive'} onClick={() => setReturnFilter('positive')} label="Positive Only" />
              <FilterButton active={returnFilter === 'negative'} onClick={() => setReturnFilter('negative')} label="Negative Only" />
            </div>
          </div>

          {/* Filter Row 3: Date Range */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Signal Date
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <FilterButton active={dateRangeFilter === 'all'} onClick={() => setDateRangeFilter('all')} label="All Time" />
              <FilterButton active={dateRangeFilter === 'lastMonth'} onClick={() => setDateRangeFilter('lastMonth')} label="Last Month" />
              <FilterButton active={dateRangeFilter === 'last3Months'} onClick={() => setDateRangeFilter('last3Months')} label="Last 3M" />
              <FilterButton active={dateRangeFilter === 'last6Months'} onClick={() => setDateRangeFilter('last6Months')} label="Last 6M" />
              <FilterButton active={dateRangeFilter === 'lastYear'} onClick={() => setDateRangeFilter('lastYear')} label="Last Year" />
            </div>
          </div>
        </div>

        {/* Right Sub-Column: Sector, Base Amount, DCA Score, Multiplier */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Sector
            </div>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="mlln-pill"
              style={{
                padding: '8px 12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border-elevated)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <option value="">All Sectors</option>
              {uniqueSectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Base Amount: £{Math.round(baseAmount)}
            </div>
            <input
              type="range"
              min="25"
              max="1000"
              step="25"
              value={baseAmount}
              onChange={(e) => setBaseAmount(Number(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Min DCA Score: {minScoreFilter > 0 ? minScoreFilter : 'None'}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(Number(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
              Min Multiplier: {minMultiplierFilter > 0 ? minMultiplierFilter.toFixed(1) : 'None'}
            </div>
            <input
              type="range"
              min="0"
              max="6"
              step="0.5"
              value={minMultiplierFilter}
              onChange={(e) => setMinMultiplierFilter(Number(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats - 30% */}
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '12px' }}>
            Summary
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--teal)', marginBottom: '8px' }}>
            {data.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            Assets with signals
          </div>
        </div>
      </div>
    </div>
  );
}
