import { GlobalNav } from '@/components/layout/GlobalNav';
import { DashboardTopbar } from '@/components/layout/DashboardTopbar';
import { MarketingFooter, MarketingStyles } from '@/components/marketing/MarketingKit';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <GlobalNav />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <DashboardTopbar />

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
          <MarketingStyles />
          <MarketingFooter />
        </div>
      </div>
    </div>
  );
}
