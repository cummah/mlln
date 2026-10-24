import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/entitlements';
import AdminTierLimitsPage from '@/components/admin/AdminTierLimitsPage';

export const dynamic = 'force-dynamic';

export default async function AdminTierLimits() {
  const admin = await isAdmin();

  if (!admin) {
    redirect('/');
  }

  return <AdminTierLimitsPage />;
}
