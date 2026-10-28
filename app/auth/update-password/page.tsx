import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UpdatePasswordForm from '@/components/auth/UpdatePasswordForm';

export const metadata = {
  title: 'Update Password | mlln.ai',
};

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=session_expired');
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      minHeight: '100vh',
      padding: '40px 20px',
      background: 'var(--bg)'
    }}>
      <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '12px',
            color: 'var(--text)'
          }}>
            Create a new password
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-2)',
            margin: 0
          }}>
            Enter your new password below.
          </p>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '28px'
        }}>
          <UpdatePasswordForm />
        </div>
      </div>
    </div>
  );
}
