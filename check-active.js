const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkActive() {
  try {
    const { data: assets, error } = await supabase
      .from('assets')
      .select('is_active');

    if (error) throw error;

    const trueCount = assets.filter(a => a.is_active === true).length;
    const falseCount = assets.filter(a => a.is_active === false).length;
    const nullCount = assets.filter(a => a.is_active === null).length;

    console.log(`Total rows: ${assets.length}`);
    console.log(`is_active = true: ${trueCount}`);
    console.log(`is_active = false: ${falseCount}`);
    console.log(`is_active = null: ${nullCount}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkActive();
