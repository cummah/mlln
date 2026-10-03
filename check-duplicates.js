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

async function checkDuplicates() {
  try {
    // Get all assets
    const { data: assets, error } = await supabase
      .from('assets')
      .select('*');

    if (error) throw error;

    console.log(`Total rows: ${assets.length}`);

    // Group by ticker + name to find duplicates
    const grouped = {};
    assets.forEach(asset => {
      const key = `${asset.ticker}|${asset.name}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(asset);
    });

    // Find duplicates
    const duplicates = Object.entries(grouped)
      .filter(([_, rows]) => rows.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`\nDuplicate groups found: ${duplicates.length}`);
    console.log(`Total duplicate rows: ${duplicates.reduce((sum, [_, rows]) => sum + rows.length, 0)}`);

    if (duplicates.length > 0) {
      console.log('\nTop duplicates:');
      duplicates.slice(0, 10).forEach(([key, rows]) => {
        const [ticker, name] = key.split('|');
        console.log(`  ${ticker} | ${name}: ${rows.length} rows`);
        rows.forEach(row => {
          console.log(`    - id: ${row.id}, created: ${row.created_at}`);
        });
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDuplicates();
