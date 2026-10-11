// One-off, read-only: dump non-reproducible tables to JSON outside the repo.
// Prices are re-fetchable from Yahoo, so daily_prices is not included.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const out = process.argv[2];
if (!out) { console.error('usage: node backup-tables.cjs <output-dir>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TABLES = ['assets', 'backtest_summary', 'backtest_summary_macro', 'sector_stats', 'ui_settings'];

async function dump(table) {
  let rows = [], page = 0;
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(page * 1000, page * 1000 + 999);
    if (error) return { error: error.message };
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  fs.writeFileSync(path.join(out, `${table}.json`), JSON.stringify(rows));
  return { rows: rows.length };
}

(async () => {
  for (const t of TABLES) console.log(t, JSON.stringify(await dump(t)));
})();
