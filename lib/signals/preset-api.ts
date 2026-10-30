import { createClient } from '@/lib/supabase/browser'
import type { Preset, PresetFreq, PresetPayload } from './presets'

export interface PresetList {
  presets: Preset[]
  limit: number
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in')

  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

export const listPresets = (freq: PresetFreq) =>
  authedFetch<PresetList>(`/api/user/signal-preferences?freq=${freq}`)

export const createPreset = (freq: PresetFreq, name: string, payload: PresetPayload, makeDefault: boolean) =>
  authedFetch<Preset>('/api/user/signal-preferences', {
    method: 'POST',
    body: JSON.stringify({ freq, name, makeDefault, ...payload }),
  })

export const updatePreset = (id: string, body: Partial<PresetPayload> & { name?: string; makeDefault?: boolean }) =>
  authedFetch<Preset>(`/api/user/signal-preferences?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const deletePreset = (id: string) =>
  authedFetch<{ success: boolean }>(`/api/user/signal-preferences?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
