import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/entitlements';
import AdminPermissionsPage from '@/components/admin/AdminPermissionsPage';

export const dynamic = 'force-dynamic';

export default async function AdminPermissions() {
  const admin = await isAdmin();

  if (!admin) {
    redirect('/');
  }

  return <AdminPermissionsPage />;
}
