'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { PRESET_NAME_MAX } from '@/lib/signals/presets'
import type { PresetsApi } from './usePresets'
import { Label } from './ui'

interface Props {
  api: PresetsApi
  onUpgrade: () => void
}

// Shared by every button in the saved-filters group, including Reset filters
export const actionButton: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '7px 10px',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: '16px',
  color: 'var(--text-2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const actionButtonPrimary: CSSProperties = { ...actionButton, background: 'var(--teal)', borderColor: 'var(--teal)', color: '#000' }

const actionButtonDanger: CSSProperties = { ...actionButton, color: '#E24B4A' }

const field = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  lineHeight: '16px',
  color: 'var(--text)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
} as const

// Buttons in rows of two, so each pair lines up and matches the rest of the group
const grid = (columns: number): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  gap: '6px',
})

export function PresetBar({ api, onUpgrade }: Props) {
  const { presets, limit, activeId, activePreset, isDirty, busy, error, message, canSave, atLimit } = api
  const [mode, setMode] = useState<'new' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<{ id: string | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setConfirmDelete(false) }, [activeId])

  if (!canSave) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Label>Saved filters</Label>
        <button onClick={onUpgrade} style={actionButtonPrimary}>Upgrade to save filters</button>
      </div>
    )
  }

  const openNew = () => { setName(''); setMakeDefault(false); setMode('new') }
  const openRename = () => { if (activePreset) { setName(activePreset.name); setMode('rename') } }

  const submit = () => {
    const n = name.trim()
    if (!n) return
    if (mode === 'new') api.saveAsNew(n, makeDefault)
    else api.rename(n)
    setMode(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <Label right={`${presets.length} / ${limit}`}>Saved filters</Label>

      <select
        value={activeId ?? ''}
        onChange={e => {
          const id = e.target.value || null
          if (api.isDirty) setPendingSwitch({ id })
          else api.select(id)
        }}
        disabled={busy}
        style={field}
      >
        <option value="">{presets.length ? 'Unsaved filter' : 'None saved yet'}</option>
        {presets.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{p.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>

      {pendingSwitch && (
        <>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Discard unsaved changes?</div>
          <div style={grid(2)}>
            <button onClick={() => setPendingSwitch(null)} style={actionButton}>Keep editing</button>
            <button
              onClick={() => { api.select(pendingSwitch.id); setPendingSwitch(null) }}
              style={actionButtonDanger}
            >
              Discard
            </button>
          </div>
        </>
      )}

      {activePreset && isDirty && (
        <>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Unsaved changes</div>
          <div style={grid(2)}>
            <button onClick={api.revert} disabled={busy} style={actionButton}>Revert</button>
            <button onClick={api.saveActive} disabled={busy} style={actionButtonPrimary}>Save changes</button>
          </div>
        </>
      )}

      {mode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            autoFocus
            value={name}
            maxLength={PRESET_NAME_MAX}
            placeholder="Filter name"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setMode(null) }}
            style={field}
          />
          {mode === 'new' && (
            <label style={{ fontSize: '11px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} />
              Load this filter by default
            </label>
          )}
          <div style={grid(2)}>
            <button onClick={submit} disabled={busy || !name.trim()} style={actionButtonPrimary}>
              {mode === 'new' ? 'Save' : 'Rename'}
            </button>
            <button onClick={() => setMode(null)} style={actionButton}>Cancel</button>
          </div>
        </div>
      ) : confirmDelete && activePreset ? (
        <>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Delete "{activePreset.name}"? This cannot be undone.</div>
          <div style={grid(2)}>
            <button onClick={() => setConfirmDelete(false)} disabled={busy} style={actionButton}>Cancel</button>
            <button onClick={api.remove} disabled={busy} style={actionButtonDanger}>Confirm delete</button>
          </div>
        </>
      ) : (
        <div style={grid(activePreset ? 2 : 1)}>
          <button
            onClick={openNew}
            disabled={busy || atLimit}
            title={atLimit ? `You can save up to ${limit} filters on this page` : undefined}
            style={{ ...actionButton, opacity: busy || atLimit ? 0.5 : 1 }}
          >
            Save as new
          </button>
          {activePreset && (
            <>
              <button onClick={openRename} disabled={busy} style={actionButton}>Rename</button>
              <button onClick={api.setDefault} disabled={busy} style={actionButton}>
                {activePreset.isDefault ? 'Unset default' : 'Set as default'}
              </button>
              <button onClick={() => setConfirmDelete(true)} disabled={busy} style={actionButtonDanger}>Delete</button>
            </>
          )}
        </div>
      )}

      {atLimit && !mode && (
        <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
          Limit reached. Delete a saved filter to add another.
        </div>
      )}
      {error && <div style={{ fontSize: '11px', color: '#E24B4A' }}>{error}</div>}
      {message && <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--teal)' }}>{message}</div>}
    </div>
  )
}
