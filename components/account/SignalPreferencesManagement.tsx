'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { Freq } from '@/lib/signals/types';

interface PreferenceInfo {
  freq: Freq;
  title: string;
  savedAt: string | null;
}

export default function SignalPreferencesManagement({ userId }: { userId: string }) {
  const supabase = createClient();
  const [preferences, setPreferences] = useState<Map<Freq, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<Freq | null>(null);

  const frequencyInfo: PreferenceInfo[] = [
    { freq: 'weekly', title: 'Weekly Signals', savedAt: preferences.get('weekly') || null },
    { freq: 'monthly', title: 'Monthly Signals', savedAt: preferences.get('monthly') || null },
  ];

  useEffect(() => {
    loadPreferences();
  }, [userId, supabase]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('signal_filter_preferences')
        .select('freq, updated_at')
        .eq('user_id', userId);

      if (error) throw error;

      const prefMap = new Map<Freq, string | null>();
      data?.forEach((pref) => {
        prefMap.set(pref.freq as Freq, pref.updated_at);
      });
      setPreferences(prefMap);
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearPreferences = async (freq: Freq) => {
    try {
      setClearing(freq);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session token');
        setClearing(null);
        return;
      }

      const response = await fetch(`/api/user/signal-preferences?freq=${freq}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const newPrefMap = new Map(preferences);
        newPrefMap.delete(freq);
        setPreferences(newPrefMap);
      } else {
        console.error('Failed to clear:', response.status);
      }
    } catch (err) {
      console.error('Failed to clear preferences:', err);
    } finally {
      setClearing(null);
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'No saved preferences';
    const date = new Date(dateStr);
    return `Last saved: ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
          Signal Filter Preferences
        </h2>
        <div style={{ color: 'var(--text-2)', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
        Signal Filter Preferences
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Your saved filter settings for signal pages. Clear to reset to defaults on your next visit.
      </p>

      <div style={{ display: 'grid', gap: '12px' }}>
        {frequencyInfo.map((info) => (
          <div
            key={info.freq}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {info.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                {formatDate(info.savedAt)}
              </div>
            </div>
            {info.savedAt && (
              <button
                onClick={() => clearPreferences(info.freq)}
                disabled={clearing === info.freq}
                style={{
                  padding: '6px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-2)',
                  cursor: clearing === info.freq ? 'not-allowed' : 'pointer',
                  opacity: clearing === info.freq ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (clearing !== info.freq) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
                }}
              >
                {clearing === info.freq ? 'Clearing...' : 'Clear'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
