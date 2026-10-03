const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Knowledge base for sectors and asset types
const KNOWN_ASSETS = {
  // ETFs
  SPY: { type: "etf", sector: "Information Technology" },
  QQQ: { type: "etf", sector: "Information Technology" },
  IVV: { type: "etf", sector: "Information Technology" },
  VTI: { type: "etf", sector: "Information Technology" },
  VUG: { type: "etf", sector: "Information Technology" },
  VTV: { type: "etf", sector: "Financials" },
  XLF: { type: "etf", sector: "Financials" },
  XLV: { type: "etf", sector: "Healthcare" },
  XLK: { type: "etf", sector: "Information Technology" },
  XLE: { type: "etf", sector: "Energy" },
  XLY: { type: "etf", sector: "Consumer Discretionary" },
  XLP: { type: "etf", sector: "Consumer Staples" },
  XLRE: { type: "etf", sector: "Real Estate" },
  XLI: { type: "etf", sector: "Industrials" },
  XLRE: { type: "etf", sector: "Real Estate" },
  XLU: { type: "etf", sector: "Utilities" },
  XLMUM: { type: "etf", sector: "Materials" },
  XLC: { type: "etf", sector: "Communication Services" },
  GLD: { type: "etf", sector: "Materials" },
  TLT: { type: "etf", sector: "Financials" },
  AGG: { type: "etf", sector: "Financials" },
  BND: { type: "etf", sector: "Financials" },
  VWO: { type: "etf", sector: "Financials" },
  EEM: { type: "etf", sector: "Financials" },
  EFA: { type: "etf", sector: "Financials" },
  VXUS: { type: "etf", sector: "Financials" },

  // Major indices and special assets
  "^VIX": { type: "volatility-index", sector: "Index" },
  "^GSPC": { type: "index", sector: "Index" },
  "^DJI": { type: "index", sector: "Index" },
  "^IXIC": { type: "index", sector: "Index" },
  "^FTSE": { type: "index", sector: "Index" },
  "^N225": { type: "index", sector: "Index" },

  // Popular stocks (sample)
  AAPL: { type: "stock", sector: "Information Technology" },
  MSFT: { type: "stock", sector: "Information Technology" },
  GOOGL: { type: "stock", sector: "Information Technology" },
  GOOG: { type: "stock", sector: "Information Technology" },
  AMZN: { type: "stock", sector: "Consumer Discretionary" },
  NVDA: { type: "stock", sector: "Information Technology" },
  META: { type: "stock", sector: "Communication Services" },
  TSLA: { type: "stock", sector: "Consumer Discretionary" },
  BRK_B: { type: "stock", sector: "Financials" },
  "BRK.B": { type: "stock", sector: "Financials" },
  JPM: { type: "stock", sector: "Financials" },
  BA: { type: "stock", sector: "Industrials" },
  JNJ: { type: "stock", sector: "Healthcare" },
  V: { type: "stock", sector: "Financials" },
  WMT: { type: "stock", sector: "Consumer Staples" },
  PG: { type: "stock", sector: "Consumer Staples" },
  KO: { type: "stock", sector: "Consumer Staples" },
  PEP: { type: "stock", sector: "Consumer Staples" },
  MCD: { type: "stock", sector: "Consumer Discretionary" },
  NKE: { type: "stock", sector: "Consumer Discretionary" },
  CSCO: { type: "stock", sector: "Information Technology" },
  INTC: { type: "stock", sector: "Information Technology" },
  AMD: { type: "stock", sector: "Information Technology" },
  NFLX: { type: "stock", sector: "Communication Services" },
  DIS: { type: "stock", sector: "Communication Services" },
  CRM: { type: "stock", sector: "Information Technology" },
  ADBE: { type: "stock", sector: "Information Technology" },
  MU: { type: "stock", sector: "Information Technology" },
  QCOM: { type: "stock", sector: "Information Technology" },
  TXN: { type: "stock", sector: "Information Technology" },
  GS: { type: "stock", sector: "Financials" },
  BAC: { type: "stock", sector: "Financials" },
  C: { type: "stock", sector: "Financials" },
  WFC: { type: "stock", sector: "Financials" },
  AXP: { type: "stock", sector: "Financials" },
  BLK: { type: "stock", sector: "Financials" },
  MMM: { type: "stock", sector: "Industrials" },
  CAT: { type: "stock", sector: "Industrials" },
  RTX: { type: "stock", sector: "Industrials" },
  LMT: { type: "stock", sector: "Industrials" },
  HON: { type: "stock", sector: "Industrials" },
  XOM: { type: "stock", sector: "Energy" },
  CVX: { type: "stock", sector: "Energy" },
  MRO: { type: "stock", sector: "Energy" },
  PSX: { type: "stock", sector: "Energy" },
  COP: { type: "stock", sector: "Energy" },
  SCHW: { type: "stock", sector: "Financials" },
  SOFI: { type: "stock", sector: "Financials" },
  COIN: { type: "stock", sector: "Information Technology" },
};

// Sector mapping for common company name patterns
const SECTOR_PATTERNS = {
  bank: "Financials",
  financial: "Financials",
  insurance: "Financials",
  oil: "Energy",
  gas: "Energy",
  energy: "Energy",
  pharma: "Healthcare",
  medical: "Healthcare",
  health: "Healthcare",
  drug: "Healthcare",
  biotech: "Healthcare",
  hospital: "Healthcare",
  tech: "Information Technology",
  software: "Information Technology",
  semiconductor: "Information Technology",
  computer: "Information Technology",
  cloud: "Information Technology",
  ai: "Information Technology",
  retail: "Consumer Discretionary",
  restaurant: "Consumer Discretionary",
  automotive: "Consumer Discretionary",
  luxury: "Consumer Discretionary",
  food: "Consumer Staples",
  beverage: "Consumer Staples",
  utility: "Utilities",
  power: "Utilities",
  reit: "Real Estate",
  manufacturing: "Industrials",
  industrial: "Industrials",
  machinery: "Industrials",
  metal: "Materials",
  mining: "Materials",
  chemical: "Materials",
  airline: "Industrials",
  transport: "Industrials",
  telecom: "Communication Services",
  media: "Communication Services",
  entertainment: "Communication Services",
  broadcasting: "Communication Services",
};

function classifyAsset(ticker, name) {
  ticker = ticker.toUpperCase().trim();
  const nameLower = (name || "").toLowerCase().trim();

  // Check exact matches first
  if (KNOWN_ASSETS[ticker]) {
    return KNOWN_ASSETS[ticker];
  }

  // Check for common patterns
  if (ticker.startsWith("^")) {
    return { type: "index", sector: "Index" };
  }

  if (
    ticker.includes("=") ||
    (ticker.length === 6 && !isNaN(ticker)) ||
    ticker.match(/^[A-Z]{6}$/)
  ) {
    // Likely forex
    return { type: "forex", sector: "Forex" };
  }

  // Check name patterns for sector hints
  for (const [pattern, sector] of Object.entries(SECTOR_PATTERNS)) {
    if (nameLower.includes(pattern)) {
      return { type: "stock", sector };
    }
  }

  // Default classification
  return { type: "stock", sector: "Other" };
}

async function classifyAllAssets() {
  try {
    console.log("Fetching all active assets...\n");

    const { data: activeAssets, error } = await supabase
      .from("assets")
      .select("id, ticker, name, sector, asset_type, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    console.log(`Found ${activeAssets.length} active assets\n`);

    const updates = [];
    const summary = {
      total: activeAssets.length,
      updated: 0,
      errors: 0,
      byType: {},
      bySector: {},
    };

    for (const asset of activeAssets) {
      const classified = classifyAsset(asset.ticker, asset.name);

      // Check if update is needed
      const needsUpdate =
        asset.asset_type !== classified.type ||
        asset.sector !== classified.sector;

      if (needsUpdate) {
        updates.push({
          id: asset.id,
          ticker: asset.ticker,
          name: asset.name,
          oldType: asset.asset_type,
          newType: classified.type,
          oldSector: asset.sector,
          newSector: classified.sector,
        });

        // Track summary
        summary.byType[classified.type] =
          (summary.byType[classified.type] || 0) + 1;
        summary.bySector[classified.sector] =
          (summary.bySector[classified.sector] || 0) + 1;
      }
    }

    // Display what will be updated
    console.log("=== UPDATES TO BE APPLIED ===\n");
    console.log(`Total assets to update: ${updates.length}\n`);

    if (updates.length > 0) {
      console.log("Sample of updates (first 20):");
      updates.slice(0, 20).forEach((u) => {
        console.log(
          `  ${u.ticker.padEnd(8)} | ${u.name.substring(0, 30).padEnd(30)} | ${u.oldType?.padEnd(20) || "null".padEnd(20)} -> ${u.newType.padEnd(20)} | ${u.oldSector?.substring(0, 20).padEnd(20) || "null".padEnd(20)} -> ${u.newSector}`
        );
      });
      console.log("");
    }

    console.log("\nSummary by Asset Type:");
    Object.entries(summary.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} assets`);
    });

    console.log("\nSummary by Sector:");
    Object.entries(summary.bySector).forEach(([sector, count]) => {
      console.log(`  ${sector}: ${count} assets`);
    });

    // Ask for confirmation before updating
    if (updates.length === 0) {
      console.log("\n✓ No updates needed - all assets are correctly classified!");
      return;
    }

    console.log(
      `\n⚠️  Ready to update ${updates.length} assets. Applying updates...\n`
    );

    // Apply updates in batches
    let successCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("assets")
        .update({
          asset_type: update.newType,
          sector: update.newSector,
        })
        .eq("id", update.id);

      if (updateError) {
        console.error(`Error updating asset ${update.ticker}:`, updateError);
        summary.errors++;
      } else {
        successCount++;
      }
    }

    console.log("\n=== UPDATE COMPLETE ===");
    console.log(`✓ Successfully updated: ${successCount} assets`);
    console.log(`✗ Failed updates: ${summary.errors} assets`);
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

classifyAllAssets();
