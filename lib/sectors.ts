// @ts-nocheck
import { getSupabaseClient } from '@/lib/supabase'

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
  const { data, error } = await getSupabaseClient()
    .from('assets')
    .select('sector')
    .eq('is_active', true)
    .not('sector', 'is', null)

  if (error) {
    console.error('Error fetching sectors:', error)
    return []
  }

  const sectors = new Set(data?.map(row => row.sector).filter(Boolean) || [])
  return Array.from(sectors).sort()
}
