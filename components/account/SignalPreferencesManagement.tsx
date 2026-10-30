'use client';

import { useEffect, useState } from 'react';
import { deletePreset, listPresets } from '@/lib/signals/preset-api';
import type { Preset, PresetFreq } from '@/lib/signals/presets';

const FREQS: { freq: PresetFreq; title: string }[] = [
  { freq: 'weekly', title: 'Weekly Signals' },
  { freq: 'monthly', title: 'Monthly Signals' },
];

type PresetsByFreq = Record<PresetFreq, Preset[]>;

export default function SignalPreferencesManagement({ userId: _userId }: { userId: string }) {
  const [presets, setPresets] = useState<PresetsByFreq>({ weekly: [], monthly: [] });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(FREQS.map(f => listPresets(f.freq)))
      .then(results => {
        if (cancelled) return;
        setPresets({ weekly: results[0].presets, monthly: results[1].presets });
      })
      .catch(err => console.error('Failed to load saved filters:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const removePreset = async (freq: PresetFreq, preset: Preset) => {
    try {
      setDeletingId(preset.id);
      await deletePreset(preset.id);
      setConfirmingId(null);
      setPresets(prev => ({ ...prev, [freq]: prev[freq].filter(p => p.id !== preset.id) }));
    } catch (err) {
      console.error('Failed to delete saved filter:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `Last saved: ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
        Saved Signal Filters
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Named filter sets you saved on the signal pages. Delete any you no longer need.
      </p>

      {loading ? (
        <div style={{ color: 'var(--text-2)', fontSize: '14px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {FREQS.map(({ freq, title }) => (
            <div key={freq}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
                {title}
              </div>
              {presets[freq].length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No saved filters</div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {presets[freq].map((preset) => (
                    <div
                      key={preset.id}
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
                          {preset.name}
                          {preset.isDefault && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '600', color: 'var(--teal)' }}>Default</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                          {formatDate(preset.updatedAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                      {confirmingId === preset.id && (
                        <button
                          onClick={() => setConfirmingId(null)}
                          disabled={deletingId === preset.id}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'var(--text-2)',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => (confirmingId === preset.id ? removePreset(freq, preset) : setConfirmingId(preset.id))}
                        disabled={deletingId === preset.id}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'var(--text-2)',
                          cursor: deletingId === preset.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === preset.id ? 0.6 : 1,
                        }}
                      >
                        {deletingId === preset.id ? 'Deleting...' : confirmingId === preset.id ? 'Confirm delete' : 'Delete'}
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
