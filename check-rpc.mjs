import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

// Try to get the schema information
const { data, error } = await supabase
  .from('information_schema.routines')
  .select('routine_name, routine_type');

if (error) {
  console.log('Cannot query information_schema directly');
} else {
  console.log('Available functions:');
  console.log(JSON.stringify(data, null, 2));
}
