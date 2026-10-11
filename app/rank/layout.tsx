import { GlobalNav } from '@/components/layout/GlobalNav';
import { DashboardTopbar } from '@/components/layout/DashboardTopbar';

export default function RankLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <GlobalNav />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <DashboardTopbar />
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
