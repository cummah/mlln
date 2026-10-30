import { createClient } from '@/lib/supabase/server'
import { getEntitlement } from '@/lib/entitlements'
import { isFreq, PRESET_NAME_MAX, presetLimit, type Preset } from '@/lib/signals/presets'
import type { Filters, Freq, Strategy } from '@/lib/signals/types'

const TABLE = 'signal_filter_preferences'
const COLUMNS = 'id,name,is_default,filters,strategy,date_preset,updated_at'

interface PresetRow {
  id: string
  name: string
  is_default: boolean
  filters: Filters
  strategy: Strategy
  date_preset: number | null
  updated_at: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const toPreset = (r: PresetRow): Preset => ({
  id: r.id,
  name: r.name,
  isDefault: r.is_default,
  filters: r.filters,
  strategy: r.strategy,
  datePreset: r.date_preset,
  updatedAt: r.updated_at,
})

function parseName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  return name.length > 0 && name.length <= PRESET_NAME_MAX ? name : null
}

function parseDatePreset(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined) return null
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { supabase, userId: user.id }
}

function isUniqueViolation(err: { code?: string }) {
  return err.code === '23505'
}

// List the user's presets for one freq, plus their limit
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth) return json({ error: 'Unauthorized' }, 401)

  const freq = new URL(request.url).searchParams.get('freq')
  if (!isFreq(freq)) return json({ error: 'Invalid freq parameter' }, 400)

  const { data, error } = await auth.supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('freq', freq)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) return json({ error: error.message }, 500)

  const { tier } = await getEntitlement()
  return json({ presets: (data as PresetRow[]).map(toPreset), limit: presetLimit(tier) })
}

// Create a preset
export async function POST(request: Request) {
  try {
    const auth = await requireUser()
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    const body = await request.json()
    const { freq, name: rawName, filters, strategy, makeDefault } = body
    const datePreset = parseDatePreset(body.datePreset)
    const name = parseName(rawName)

    if (!isFreq(freq) || !name || !isObject(filters) || !isObject(strategy) || datePreset === undefined) {
      return json({ error: 'Missing or invalid fields: freq, name, filters, strategy' }, 400)
    }

    const { tier } = await getEntitlement()
    const limit = presetLimit(tier)
    const { count, error: countError } = await auth.supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('freq', freq)
    if (countError) return json({ error: countError.message }, 500)

    if ((count ?? 0) >= limit) {
      return json({
        error: limit === 0 ? 'Saving filters needs a paid plan' : `You can save up to ${limit} filters on this page`,
      }, 403)
    }

    if (makeDefault) await clearDefault(auth.supabase, freq)

    const { data, error } = await auth.supabase
      .from(TABLE)
      .insert({
        user_id: auth.userId,
        freq,
        name,
        is_default: Boolean(makeDefault),
        filters,
        strategy,
        date_preset: datePreset,
        updated_at: new Date().toISOString(),
      })
      .select(COLUMNS)
      .single()

    if (error) {
      if (isUniqueViolation(error)) return json({ error: 'A filter with that name already exists' }, 409)
      return json({ error: `Database error: ${error.message}` }, 500)
    }

    return json(toPreset(data as PresetRow), 201)
  } catch (err) {
    return json({ error: `Server error: ${err instanceof Error ? err.message : 'unknown'}` }, 500)
  }
}

// Rename, overwrite, or set as default
export async function PATCH(request: Request) {
  try {
    const auth = await requireUser()
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Missing id parameter' }, 400)

    const body = await request.json()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) {
      const name = parseName(body.name)
      if (!name) return json({ error: `Name must be 1 to ${PRESET_NAME_MAX} characters` }, 400)
      patch.name = name
    }
    if (body.filters !== undefined) {
      if (!isObject(body.filters)) return json({ error: 'Invalid filters' }, 400)
      patch.filters = body.filters
    }
    if (body.strategy !== undefined) {
      if (!isObject(body.strategy)) return json({ error: 'Invalid strategy' }, 400)
      patch.strategy = body.strategy
    }
    if (body.datePreset !== undefined) {
      const datePreset = parseDatePreset(body.datePreset)
      if (datePreset === undefined) return json({ error: 'Invalid datePreset' }, 400)
      patch.date_preset = datePreset
    }

    // Look up freq first so the old default can be cleared before the new one is set
    const { data: existing, error: lookupError } = await auth.supabase
      .from(TABLE)
      .select('freq')
      .eq('id', id)
      .single()
    if (lookupError || !existing) return json({ error: 'Preset not found' }, 404)

    if (body.makeDefault === true) {
      await clearDefault(auth.supabase, existing.freq as Freq, id)
      patch.is_default = true
    } else if (body.makeDefault === false) {
      patch.is_default = false
    }

    const { data, error } = await auth.supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) {
      if (isUniqueViolation(error)) return json({ error: 'A filter with that name already exists' }, 409)
      return json({ error: `Database error: ${error.message}` }, 500)
    }

    return json(toPreset(data as PresetRow))
  } catch (err) {
    return json({ error: `Server error: ${err instanceof Error ? err.message : 'unknown'}` }, 500)
  }
}

// Delete one preset
export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth) return json({ error: 'Unauthorized' }, 401)

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing id parameter' }, 400)

  const { error } = await auth.supabase.from(TABLE).delete().eq('id', id)
  if (error) return json({ error: error.message }, 500)

  return json({ success: true })
}

// Unset the current default for a freq, optionally leaving one row alone
async function clearDefault(supabase: Awaited<ReturnType<typeof createClient>>, freq: Freq, exceptId?: string) {
  let query = supabase.from(TABLE).update({ is_default: false }).eq('freq', freq).eq('is_default', true)
  if (exceptId) query = query.neq('id', exceptId)
  await query
}
