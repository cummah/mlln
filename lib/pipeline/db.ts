// Database helpers for batch jobs. Unlike the old scripts, nothing here swallows an error:
// a failed read or write throws, so a half-finished run can never look like a success.

import * as fs from 'fs'
import * as path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function loadEnv(): void {
  const file = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

let client: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (client) return client
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  client = createClient(url, key, {
    // A stalled request must fail, not hang the whole run.
    global: { fetch: (u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(60000) }) },
    auth: { persistSession: false },
  })
  return client
}

export async function withRetry<T>(label: string, fn: () => PromiseLike<T>, tries = 4): Promise<T> {
  let last: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (attempt < tries) await new Promise(r => setTimeout(r, 500 * 2 ** attempt))
    }
  }
  throw new Error(`${label} failed after ${tries} attempts: ${last instanceof Error ? last.message : JSON.stringify(last)}`)
}

/** Read every row of a query, 1000 at a time. Throws on any error. */
export async function pagedSelect<T = any>(
  label: string,
  build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; ; page++) {
    const from = page * pageSize
    const data = await withRetry(label, async () => {
      const { data, error } = await build(from, from + pageSize - 1)
      if (error) throw new Error(error.message ?? JSON.stringify(error))
      return data as T[] | null
    })
    if (!data || data.length === 0) break
    for (const row of data) all.push(row)
    if (data.length < pageSize) break
  }
  return all
}

/** Upsert in chunks. Throws on any error so the caller sees partial writes as a failure. */
export async function upsertChunks(table: string, rows: any[], onConflict: string, chunk = 500): Promise<number> {
  const db = getDb()
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    await withRetry(`upsert ${table} [${i}..${i + slice.length}]`, async () => {
      const { error } = await db.from(table).upsert(slice, { onConflict })
      if (error) throw new Error(error.message)
    })
  }
  return rows.length
}

/** Run fn over items with bounded concurrency, preserving order. Any rejection rejects the whole run. */
export async function pool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

export async function recordRun(
  step: string,
  runDate: string,
  status: 'ok' | 'failed' | 'partial',
  detail: Record<string, unknown>,
  startedAt: Date
): Promise<void> {
  const { error } = await getDb().from('pipeline_runs').insert({
    run_date: runDate,
    step,
    status,
    detail,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
  })
  if (error) throw new Error(`could not record run for ${step}: ${error.message}`)
}
