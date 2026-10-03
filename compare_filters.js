const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "SUPABASE_URL and SUPABASE_ANON_KEY env vars required"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllPages(queryFn) {
  const results = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await queryFn(page * pageSize, (page + 1) * pageSize);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...data);
    page++;
  }

  return results;
}

async function compareFilters() {
  try {
    const MIN_DCA_SCORE = 70;
    const WINDOW_DAYS = 84;
    const BASE_AMOUNT = 100;

    console.log("Fetching data with both filters...\n");

    // Get assets with DCA score >= 70
    console.log(`[1] Fetching assets with DCA score >= ${MIN_DCA_SCORE}...`);
    const qualifyingScores = await fetchAllPages((from, to) =>
      supabase
        .from("backtest_summary")
        .select("ticker, dca_suitability_score")
        .gte("dca_suitability_score", MIN_DCA_SCORE)
        .range(from, to)
    );

    const scoreQualifyingTickers = new Set(
      qualifyingScores.map((s) => s.ticker.toUpperCase())
    );
    console.log(`   Found ${scoreQualifyingTickers.size} assets\n`);

    // Get all signals in the window
    console.log(`[2] Fetching all signals within last ${WINDOW_DAYS} days...`);
    const allAssets = await fetchAllPages((from, to) =>
      supabase
        .from("assets")
        .select("ticker")
        .eq("is_active", true)
        .range(from, to)
    );

    const allTickers = allAssets.map((a) => a.ticker.toUpperCase());
    const cutoffMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

    // Fetch all enriched signals
    const enrichmentRows = await fetchAllPages((from, to) =>
      supabase
        .from("daily_signal_enrichment")
        .select("ticker, signals")
        .in("ticker", allTickers)
        .range(from, to)
    );

    // Count signals by filter
    let scoreFilterCount = 0;
    let multiplierFilterCount = 0;
    let bothFilterCount = 0;

    const signalsByMultiplier = { under4: [], over4: [] };
    const signalsByScore = { under70: [], over70: [] };

    for (const row of enrichmentRows) {
      const signals = row.signals || [];
      const tickerUpper = row.ticker.toUpperCase();

      for (const sig of signals) {
        if (new Date(sig.date).getTime() < cutoffMs) continue;

        const mult = sig.finalMult || 0;
        const dcaScore = qualifyingScores.find(
          (s) => s.ticker.toUpperCase() === tickerUpper
        )?.dca_suitability_score || 0;

        const passesScoreFilter = scoreQualifyingTickers.has(tickerUpper);
        const passesMultiplierFilter = mult >= 4;

        if (passesScoreFilter) scoreFilterCount++;
        if (passesMultiplierFilter) multiplierFilterCount++;
        if (passesScoreFilter && passesMultiplierFilter) bothFilterCount++;

        if (mult < 4) signalsByMultiplier.under4.push(mult);
        else signalsByMultiplier.over4.push(mult);

        if (dcaScore < 70) signalsByScore.under70.push(dcaScore);
        else signalsByScore.over70.push(dcaScore);
      }
    }

    console.log(`\n=== COMPARISON ===\n`);
    console.log(`Current Filter (DCA Score >= 70):`);
    console.log(`  Signals: ${scoreFilterCount.toLocaleString()}\n`);

    console.log(`Alternative Filter (Multiplier >= 4):`);
    console.log(`  Signals: ${multiplierFilterCount.toLocaleString()}\n`);

    console.log(`Both Filters:`);
    console.log(`  Signals: ${bothFilterCount.toLocaleString()}\n`);

    console.log(`=== DIFFERENCE ===`);
    const diff = scoreFilterCount - multiplierFilterCount;
    const diffPercent = (
      ((scoreFilterCount - multiplierFilterCount) / scoreFilterCount) * 100
    ).toFixed(1);
    console.log(
      `${Math.abs(diff).toLocaleString()} signals (${diffPercent}%) ${
        diff > 0 ? "fewer" : "more"
      } with multiplier >= 4`
    );

    console.log(`\n=== SIGNAL DISTRIBUTION ===\n`);
    console.log(
      `Signals with Multiplier < 4: ${signalsByMultiplier.under4.length.toLocaleString()}`
    );
    if (signalsByMultiplier.under4.length > 0) {
      const avg = (
        signalsByMultiplier.under4.reduce((a, b) => a + b, 0) /
        signalsByMultiplier.under4.length
      ).toFixed(2);
      const min = Math.min(...signalsByMultiplier.under4).toFixed(2);
      const max = Math.max(...signalsByMultiplier.under4).toFixed(2);
      console.log(`   Min: ${min}, Max: ${max}, Avg: ${avg}`);
    }

    console.log(
      `Signals with Multiplier >= 4: ${signalsByMultiplier.over4.length.toLocaleString()}`
    );
    if (signalsByMultiplier.over4.length > 0) {
      const avg = (
        signalsByMultiplier.over4.reduce((a, b) => a + b, 0) /
        signalsByMultiplier.over4.length
      ).toFixed(2);
      const min = Math.min(...signalsByMultiplier.over4).toFixed(2);
      const max = Math.max(...signalsByMultiplier.over4).toFixed(2);
      console.log(`   Min: ${min}, Max: ${max}, Avg: ${avg}`);
    }

    console.log(`\n=== ADDITIONAL LIMITERS OPTIONS ===\n`);
    console.log(`You could combine multiplier >= 4 with:\n`);
    console.log(
      `1. Conviction Score (finalConvictionScore) — limits to high-confidence signals`
    );
    console.log(`2. Volatility band — exclude highly volatile assets`);
    console.log(`3. Timeframe alignment — require weekly/monthly confirmation`);
    console.log(`4. Factor Regime score — align with macro regime strength`);
    console.log(
      `5. Recent performance filter — only show signals with positive recent returns`
    );
    console.log(
      `6. Win rate threshold — only show assets with >50% win rate on similar signals`
    );
  } catch (err) {
    console.error("Error:", err.message);
  }
}

compareFilters();
