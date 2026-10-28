import PasswordResetForm from '@/components/auth/PasswordResetForm';

export const metadata = {
  title: 'Reset Password | mlln.ai',
};

export default function ResetPasswordPage() {
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
            Reset your password
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-2)',
            margin: 0
          }}>
            Enter your email and we'll send you a link to create a new password.
          </p>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '28px'
        }}>
          <PasswordResetForm />
        </div>
      </div>
    </div>
  );
}
