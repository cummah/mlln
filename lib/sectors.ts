// @ts-nocheck
import { fetchAllPages, getSupabaseClient } from '@/lib/supabase'

export function sectorToSlug(sector: string): string {
  return sector
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
}

export function slugToSector(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function getAllSectors(): Promise<string[]> {
  // Read every active asset: a single unpaginated query is cut off at 1000 rows and can drop sectors
  const rows = await fetchAllPages<{ sector: string | null }>((from, to) =>
    getSupabaseClient().from('assets').select('sector').eq('is_active', true).not('sector', 'is', null).order('ticker').range(from, to))
  return Array.from(new Set(rows.map(r => r.sector).filter((x): x is string => !!x))).sort()
}
