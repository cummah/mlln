import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function apply() {
  const sql = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20260524_add_fundamental_columns.sql'), 'utf-8')
  const { data, error } = await supabase.rpc('execute_sql', { sql })
  
  if (error) {
    console.error('Error applying migration:', error)
  } else {
    console.log('Migration applied successfully:', data)
  }
}

apply()
