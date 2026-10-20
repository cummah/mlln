import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PaymentSuccessContent from '@/components/payment/PaymentSuccessContent';

export const dynamic = 'force-dynamic';

export default async function PaymentSuccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <PaymentSuccessContent user={user} />;
}
