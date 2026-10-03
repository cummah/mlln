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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function markInactive() {
  console.log('Marking BRCC as inactive (is_active = false) due to 10-1 stock split...\n');

  const { error } = await supabase
    .from('assets')
    .update({ is_active: false })
    .eq('ticker', 'BRCC');

  if (error) {
    console.error(`✗ BRCC: ${error.message}`);
    process.exit(1);
  } else {
    console.log(`✓ BRCC: marked as inactive`);
  }

  console.log('\nDone!');
  process.exit(0);
}

markInactive().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
