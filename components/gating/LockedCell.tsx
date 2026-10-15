export function LockedCell({ onUpgradeClick }: { onUpgradeClick?: () => void }) {
  return (
    <button
      onClick={onUpgradeClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-2)',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        minWidth: '80px',
        transition: 'all 0.2s',
        textDecoration: 'none',
        fontFamily: 'inherit'
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--teal)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
      }}
    >
      <LockIcon />
      <span>••••</span>
    </button>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
