'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FREQ_SETTINGS } from '@/lib/signals/config'
import { isFreq, presetKey, sortPresets, toPayload, toState, type Preset, type PresetState } from '@/lib/signals/presets'
import { createPreset, deletePreset, listPresets, updatePreset } from '@/lib/signals/preset-api'
import type { Freq } from '@/lib/signals/types'

interface Options {
  freq: Freq
  current: PresetState
  apply: (s: PresetState) => void
}

// Holds the saved presets for one freq and the one currently loaded into the page.
// "Dirty" means the page differs from the loaded preset, so Revert can restore it.
export function usePresets({ freq, current, apply }: Options) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [limit, setLimit] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const applyRef = useRef(apply)
  useEffect(() => { applyRef.current = apply })

  const presetFreq = isFreq(freq) ? freq : null
  const activePreset = presets.find(p => p.id === activeId) ?? null
  const baseFallback = FREQ_SETTINGS[freq].baseAmount
  const isDirty = activePreset !== null &&
    presetKey(toPayload(current)) !== presetKey(toPayload(toState(activePreset, baseFallback)))

  // Load on mount, and apply the default preset if there is one
  useEffect(() => {
    if (!isFreq(freq)) return
    let cancelled = false
    setActiveId(null)
    listPresets(freq)
      .then(res => {
        if (cancelled) return
        setPresets(res.presets)
        setLimit(res.limit)
        const def = res.presets.find(p => p.isDefault)
        if (def) {
          applyRef.current(toState(def, FREQ_SETTINGS[freq].baseAmount))
          setActiveId(def.id)
        }
      })
      .catch(err => { if (!cancelled) console.error('Failed to load saved filters:', err) })
    return () => { cancelled = true }
  }, [freq])

  const flash = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  // Keep the local list in step with the server, including clearing the old default
  const upsertLocal = useCallback((p: Preset) => {
    setPresets(ps => [
      ...ps.filter(x => x.id !== p.id).map(x => (p.isDefault && x.isDefault ? { ...x, isDefault: false } : x)),
      p,
    ].sort(sortPresets))
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const select = (id: string | null) => {
    if (id === activeId) return
    setError(null)
    if (id === null) {
      setActiveId(null)
      return
    }
    const p = presets.find(x => x.id === id)
    if (!p) return
    apply(toState(p, baseFallback))
    setActiveId(p.id)
  }

  const saveActive = () => {
    if (!activePreset) return
    run(async () => {
      const p = await updatePreset(activePreset.id, toPayload(current))
      upsertLocal(p)
      flash('Saved')
    })
  }

  const saveAsNew = (name: string, makeDefault: boolean) => {
    if (!presetFreq) return
    run(async () => {
      const p = await createPreset(presetFreq, name, toPayload(current), makeDefault)
      upsertLocal(p)
      setActiveId(p.id)
      flash('Saved')
    })
  }

  const rename = (name: string) => {
    if (!activePreset) return
    run(async () => {
      upsertLocal(await updatePreset(activePreset.id, { name }))
    })
  }

  const setDefault = () => {
    if (!activePreset) return
    run(async () => {
      upsertLocal(await updatePreset(activePreset.id, { makeDefault: !activePreset.isDefault }))
    })
  }

  const remove = () => {
    if (!activePreset) return
    const id = activePreset.id
    run(async () => {
      await deletePreset(id)
      setPresets(ps => ps.filter(x => x.id !== id))
      setActiveId(null)
      flash('Deleted')
    })
  }

  const revert = () => {
    if (!activePreset) return
    apply(toState(activePreset, baseFallback))
  }

  return {
    presets,
    limit,
    activeId,
    activePreset,
    isDirty,
    busy,
    error,
    message,
    canSave: limit > 0,
    atLimit: presets.length >= limit,
    select,
    saveActive,
    saveAsNew,
    rename,
    setDefault,
    remove,
    revert,
  }
}

export type PresetsApi = ReturnType<typeof usePresets>
