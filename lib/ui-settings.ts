import { getSupabaseClient } from '@/lib/supabase'

// Cache settings in memory for performance
let settingsCache: Record<string, any> | null = null
let cacheTime = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

export async function getUISetting(key: string): Promise<any> {
  try {
    // Check cache first
    if (settingsCache && Date.now() - cacheTime < CACHE_DURATION) {
      return settingsCache[key]
    }

    // Fetch from database
    const { data, error } = await getSupabaseClient()
      .from('ui_settings')
      .select('setting_key, setting_value, data_type')
      .eq('setting_key', key)
      .single() as any

    if (error || !data) {
      console.warn(`UI setting not found: ${key}`)
      return null
    }

    // Convert value based on data_type
    const value = convertSettingValue(data.setting_value, data.data_type)
    return value
  } catch (err) {
    console.error(`Error fetching UI setting ${key}:`, err)
    return null
  }
}

export async function getAllUISettings(): Promise<Record<string, any>> {
  try {
    // Check cache first
    if (settingsCache && Date.now() - cacheTime < CACHE_DURATION) {
      return settingsCache
    }

    // Fetch all settings
    const { data, error } = await getSupabaseClient()
      .from('ui_settings')
      .select('setting_key, setting_value, data_type') as any

    if (error || !data) {
      console.warn('Failed to fetch UI settings')
      return {}
    }

    // Convert all values and build cache
    const settings: Record<string, any> = {}
    for (const row of data) {
      settings[row.setting_key] = convertSettingValue(row.setting_value, row.data_type)
    }

    // Update cache
    settingsCache = settings
    cacheTime = Date.now()

    return settings
  } catch (err) {
    console.error('Error fetching UI settings:', err)
    return {}
  }
}

function convertSettingValue(value: string, dataType: string): any {
  switch (dataType) {
    case 'integer':
      return parseInt(value, 10)
    case 'boolean':
      return value.toLowerCase() === 'true'
    case 'string':
    default:
      return value
  }
}

// Helper functions for common settings
export async function getTopPerformersCount(): Promise<number> {
  return (await getUISetting('sector_top_performers_count')) || 3
}

export async function getTopPerformersExampleCount(): Promise<number> {
  return (await getUISetting('sector_top_performers_example_count')) || 2
}

export async function getRelatedSectorsCount(): Promise<number> {
  return (await getUISetting('sector_related_count')) || 4
}

export async function getSkeletonLoadersCount(): Promise<number> {
  return (await getUISetting('sector_skeleton_loaders_count')) || 10
}

export async function getSignalReasoningTruncateChars(): Promise<number> {
  return (await getUISetting('sector_signal_reasoning_truncate_chars')) || 0
}

export async function getRecentSignalsDaysWindow(): Promise<number> {
  return (await getUISetting('sector_recent_signals_days_window')) || 30
}

export async function getPeriodsToShow(): Promise<string[]> {
  const periods = (await getUISetting('sector_stats_periods_to_show')) || '1M,3M,1Y'
  return periods.split(',').map((p: string) => p.trim())
}

export async function getTableRowsLimit(): Promise<number> {
  return (await getUISetting('sector_table_rows_limit')) || 10
}

export async function getTopPerformersLimit(): Promise<number> {
  return (await getUISetting('sector_top_performers_limit')) || 10
}
