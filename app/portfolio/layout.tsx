import { GlobalNav } from '@/components/layout/GlobalNav';
import { DashboardTopbar } from '@/components/layout/DashboardTopbar';

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <GlobalNav />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <DashboardTopbar breadcrumb="Portfolio" />

        {/* Single scroll container. This used to nest a second overflowY:auto
            inside the one above it, which gave the page two scrollbars and broke
            sticky positioning for anything inside. */}
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
