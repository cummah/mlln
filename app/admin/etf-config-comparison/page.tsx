import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/entitlements';
import EtfConfigComparisonPage from '@/components/admin/EtfConfigComparisonPage';

export const dynamic = 'force-dynamic';

export default async function EtfConfigComparison() {
  const admin = await isAdmin();

  if (!admin) {
    redirect('/');
  }

  return <EtfConfigComparisonPage />;
}
