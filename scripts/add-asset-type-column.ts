import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["'](.*)["']$/, '$1')
      process.env[key] = value
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function addColumn() {
  console.log('Adding asset_type column to assets table...')
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT;"
  })

  if (error) {
    console.error('Error adding column:', error)
    
    // Fallback: Check if it already exists by trying to select it
    const { data: sample, error: selectError } = await supabase
      .from('assets')
      .select('asset_type')
      .limit(1)
    
    if (!selectError) {
      console.log('Column asset_type already exists.')
    } else {
      console.error('Failed to add column and it does not seem to exist.', selectError)
    }
  } else {
    console.log('Column asset_type added successfully.')
  }
}

addColumn()
