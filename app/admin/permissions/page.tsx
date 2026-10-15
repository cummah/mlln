import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminPermissionsPage from '@/components/admin/AdminPermissionsPage';

export const dynamic = 'force-dynamic';

export default async function AdminPermissions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // TODO: Check if user is an admin. For now, we'll check if they're tc@phycomex.com
  if (user.email !== 'tc@phycomex.com') {
    redirect('/');
  }

  return <AdminPermissionsPage />;
}
