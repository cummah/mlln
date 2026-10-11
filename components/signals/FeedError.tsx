// Shown when the data cannot be loaded. It says so plainly. It never substitutes sample or empty numbers.
export function FeedError({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '28px', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>{title}</h1>
      <div role="alert" style={{ background: 'rgba(226,75,74,0.12)', border: '1px solid #E24B4A', borderRadius: '8px', padding: '14px 16px', color: 'var(--text)', fontSize: '14px', lineHeight: 1.5 }}>
        The signals could not be loaded, so nothing is shown rather than showing something wrong.
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-2)', fontFamily: 'DM Mono, monospace' }}>{message}</div>
      </div>
    </div>
  )
}
