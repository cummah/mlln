import type { Filters, Freq, Strategy } from './types'

// Named filter presets for the weekly and monthly signal pages.
// Shared by the API route (server) and the client hook, so keep it free of browser or server imports.

export const PRESET_NAME_MAX = 40

// Daily has no presets. Only the weekly and monthly pages save filters.
export type PresetFreq = Extract<Freq, 'weekly' | 'monthly'>

// Free users cannot save. Tier 1 gets one preset. Tier 2 and above get four.
export function presetLimit(tier: number): number {
  if (tier >= 2) return 4
  if (tier === 1) return 1
  return 0
}

export interface Preset {
  id: string
  name: string
  isDefault: boolean
  filters: Filters
  strategy: Strategy // includes base
  datePreset: number | null
  updatedAt: string
}

// What the page's live state looks like. Base lives outside the strategy in page state.
export interface PresetState {
  filters: Filters
  strategy: Strategy
  base: number
  datePreset: number | null
}

export interface PresetPayload {
  filters: Filters
  strategy: Strategy & { base: number }
  datePreset: number | null
}

export function toPayload(s: PresetState): PresetPayload {
  return { filters: s.filters, strategy: { ...s.strategy, base: s.base }, datePreset: s.datePreset }
}

export function toState(p: Preset, fallbackBase: number): PresetState {
  const { base, ...strategy } = p.strategy
  return { filters: p.filters, strategy, base: base ?? fallbackBase, datePreset: p.datePreset }
}

// Postgres jsonb does not keep key order, so compare with sorted keys.
export function presetKey(v: unknown): string {
  return JSON.stringify(v, (_, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).sort().reduce<Record<string, unknown>>((o, k) => {
        o[k] = (val as Record<string, unknown>)[k]
        return o
      }, {})
    }
    return val
  })
}

export function sortPresets(a: Preset, b: Preset): number {
  return Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)
}

export function isFreq(v: unknown): v is PresetFreq {
  return v === 'weekly' || v === 'monthly'
}
