import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LoginForm from '@/components/auth/LoginForm';

export default async function LoginPage() {
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
            Sign in to mlln
          </h1>
          <p style={{
            color: 'var(--text-2)',
            fontSize: '14px'
          }}>
            Enter your email to access your account
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
