import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminTierLimitsPage from '@/components/admin/AdminTierLimitsPage';

export const dynamic = 'force-dynamic';

export default async function AdminTierLimits() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (user.email !== 'tc@phycomex.com') {
    redirect('/');
  }

  return <AdminTierLimitsPage />;
}
