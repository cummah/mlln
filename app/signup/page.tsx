import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SignupForm from '@/components/auth/SignupForm';

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/account');
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            marginBottom: '8px',
            color: 'var(--text)'
          }}>
            Join mlln
          </h1>
          <p style={{
            color: 'var(--text-2)',
            fontSize: '14px'
          }}>
            Create an account to get started with DCA signals
          </p>
        </div>

        <SignupForm />
      </div>
    </div>
  );
}
