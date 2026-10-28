'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

interface AccountSecurityPanelProps {
  email: string | undefined;
}

export default function AccountSecurityPanel({ email }: AccountSecurityPanelProps) {
  const router = useRouter();
  const supabase = createClient();

  // Email change state
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Data export state
  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportData = async () => {
    setExportingData(true);
    setExportError(null);

    try {
      const res = await fetch('/api/user/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        setExportError(data.error || 'Failed to export data');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mlln-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setExportError('An error occurred. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!newEmail) {
      setEmailError('Email is required');
      return;
    }

    if (newEmail === email) {
      setEmailError('New email must be different from current email');
      return;
    }

    setChangingEmail(true);

    try {
      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEmailError(data.error || 'Failed to change email');
      } else {
        setEmailSuccess('Confirmation link sent to your new email. Please verify it to complete the change.');
        setNewEmail('');
        setShowEmailChange(false);
      }
    } catch (err) {
      setEmailError('An error occurred. Please try again.');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type "DELETE" to confirm');
      return;
    }

    setDeletingAccount(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete account');
      } else {
        await supabase.auth.signOut();
        router.push('/');
      }
    } catch (err) {
      setDeleteError('An error occurred. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Change Email Section */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '28px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
          Email Address
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
            Current Email
          </label>
          <div style={{ fontSize: '14px', color: 'var(--text)', padding: '10px 12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {email}
          </div>
        </div>

        {!showEmailChange ? (
          <button
            onClick={() => setShowEmailChange(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--teal)',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Change email
          </button>
        ) : (
          <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email"
              placeholder="new@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={changingEmail}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                opacity: changingEmail ? 0.6 : 1
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={changingEmail || !newEmail}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--teal)',
                  color: 'var(--bg)',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: changingEmail || !newEmail ? 'not-allowed' : 'pointer',
                  opacity: changingEmail || !newEmail ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {changingEmail ? 'Sending...' : 'Send confirmation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmailChange(false);
                  setNewEmail('');
                  setEmailError(null);
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
            </div>
            {emailError && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 0, 0, 0.1)',
                color: '#ff6b6b',
                fontSize: '12px',
                border: '1px solid rgba(255, 107, 107, 0.3)'
              }}>
                {emailError}
              </div>
            )}
            {emailSuccess && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 200, 180, 0.1)',
                color: 'var(--teal)',
                fontSize: '12px',
                border: '1px solid rgba(0, 200, 180, 0.3)'
              }}>
                {emailSuccess}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Data Export Section */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '28px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
          Download Your Data
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
          Export all your data including profile, watchlists, and portfolios as a JSON file.
        </p>

        <button
          onClick={handleExportData}
          disabled={exportingData}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text)',
            fontWeight: '600',
            fontSize: '13px',
            cursor: exportingData ? 'not-allowed' : 'pointer',
            opacity: exportingData ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
        >
          {exportingData ? 'Exporting...' : 'Download data as JSON'}
        </button>

        {exportError && (
          <div style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(255, 0, 0, 0.1)',
            color: '#ff6b6b',
            fontSize: '12px',
            border: '1px solid rgba(255, 107, 107, 0.3)'
          }}>
            {exportError}
          </div>
        )}
      </div>

      {/* Delete Account Section */}
      <div style={{
        background: 'var(--surface)',
        border: '2px solid #ff6b6b',
        borderRadius: '12px',
        padding: '28px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#ff6b6b' }}>
          Delete Account
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#ff6b6b',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: 0.8
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              fontSize: '12px',
              color: '#ff6b6b'
            }}>
              ⚠️ This will permanently delete your account, profile, watchlists, and portfolios.
            </div>

            <label style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
              Type "DELETE" to confirm:
            </label>
            <input
              type="text"
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              disabled={deletingAccount}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #ff6b6b',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                fontWeight: '600',
                opacity: deletingAccount ? 0.6 : 1
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ff6b6b',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: deletingAccount || deleteConfirmText !== 'DELETE' ? 'not-allowed' : 'pointer',
                  opacity: deletingAccount || deleteConfirmText !== 'DELETE' ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {deletingAccount ? 'Deleting...' : 'Permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
            </div>

            {deleteError && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 0, 0, 0.1)',
                color: '#ff6b6b',
                fontSize: '12px',
                border: '1px solid rgba(255, 107, 107, 0.3)'
              }}>
                {deleteError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
