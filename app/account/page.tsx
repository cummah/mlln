import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AccountPage from '@/components/account/AccountPage';

export const dynamic = 'force-dynamic';

export default async function Account() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AccountPage user={user} />;
}
