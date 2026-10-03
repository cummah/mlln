import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load env
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)/)
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    env[key] = value;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log('Checking if asset_type column exists...');
const { data, error } = await supabase
  .from('assets')
  .select('asset_type')
  .limit(1);

if (error && error.message.includes('does not exist')) {
  console.log('❌ asset_type column does NOT exist');
  console.log('Need to add the column first');
} else if (error) {
  console.log('Error:', error);
} else {
  console.log('✅ asset_type column EXISTS');
  console.log('Sample:', data);
}

// Check total active assets
const { data: assets } = await supabase
  .from('assets')
  .select('ticker', { count: 'exact' })
  .eq('is_active', true);

console.log(`Total active assets: ${assets?.length || 0}`);
