export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Breadcrumb skeleton */}
      <div style={{ height: '14px', width: '160px', background: 'var(--surface2)', borderRadius: '4px' }} className="animate-pulse" />

      {/* Header skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ height: '28px', width: '260px', background: 'var(--surface2)', borderRadius: '6px' }} className="animate-pulse" />
        <div style={{ height: '14px', width: '360px', background: 'var(--surface2)', borderRadius: '4px' }} className="animate-pulse" />
      </div>

      {/* Filters + stats skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          {[0, 1].map((col) => (
            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} style={{ height: '36px', background: 'var(--surface2)', borderRadius: '8px' }} className="animate-pulse" />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', height: '64px' }} className="animate-pulse" />
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div style={{ height: '220px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }} className="animate-pulse" />

      {/* Table skeleton */}
      <div style={{ border: '1px solid var(--border-elevated)', borderRadius: '12px', background: 'var(--surface-elevated)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ height: '32px', background: 'var(--surface2)', borderRadius: '6px' }} className="animate-pulse" />
        ))}
      </div>
    </div>
  );
}
