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

async function setupRPC() {
  console.log('Setting up exec_sql RPC function...')

  // Read the migration file
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/add_asset_type_column.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

  // Create the RPC function that can execute SQL
  const createRpcSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `

  try {
    // Execute the RPC creation SQL using rpc
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: createRpcSql
    })

    if (rpcError && rpcError.message.includes('does not exist')) {
      // RPC doesn't exist, so we need to create it using a different method
      console.log('RPC function does not exist yet. Need direct access to create it.')
      console.log('Attempting alternative approach using Supabase REST API...')

      // Try using the SQL directly via a workaround
      // For now, just execute the migration SQL directly
      console.log('Executing migration SQL...')

      // Split the migration into individual statements
      const statements = migrationSql.split(';').filter(s => s.trim())
      for (const stmt of statements) {
        if (stmt.trim()) {
          console.log(`Executing: ${stmt.trim().substring(0, 80)}...`)
        }
      }

      console.log('⚠️  Direct SQL execution requires Supabase CLI or dashboard access.')
      console.log('Please run the migration via the Supabase dashboard:')
      console.log('1. Go to SQL Editor')
      console.log('2. Create a new query')
      console.log('3. Paste the contents of supabase/migrations/add_asset_type_column.sql')
      console.log('4. Click "Run"')
    } else if (rpcError) {
      console.error('Error creating RPC:', rpcError)
    } else {
      console.log('✅ RPC function created successfully')

      // Now execute the migration
      console.log('Executing migration...')
      const { error: migrationError } = await supabase.rpc('exec_sql', {
        sql: migrationSql
      })

      if (migrationError) {
        console.error('Error executing migration:', migrationError)
      } else {
        console.log('✅ Migration executed successfully')
      }
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

setupRPC()
