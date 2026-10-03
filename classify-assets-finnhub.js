const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env.local manually
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length > 0) {
    process.env[key.trim()] = rest.join("=").trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const finnhubKey = process.env.FINNHUB_API_KEY;

if (!finnhubKey) {
  console.error("Error: FINNHUB_API_KEY not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Known asset type classifications
const KNOWN_TYPES = {
  "^VIX": "volatility-index",
  "^GSPC": "index",
  "^DJI": "index",
  "^IXIC": "index",
  "^FTSE": "index",
  "^N225": "index",
};

// Known ETFs
const KNOWN_ETFS = [
  "SPY",
  "QQQ",
  "IVV",
  "VTI",
  "VUG",
  "VTV",
  "XLF",
  "XLV",
  "XLK",
  "XLE",
  "XLY",
  "XLP",
  "XLRE",
  "XLI",
  "XLU",
  "XLMUM",
  "XLC",
  "GLD",
  "TLT",
  "AGG",
  "BND",
  "VWO",
  "EEM",
  "EFA",
  "VXUS",
  "PRWCX",
  "VFIAX",
  "VTSAX",
  "VBTLX",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchFromFinnhub(path) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1${path}&token=${finnhubKey}`;

    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({});
          }
        });
      })
      .on("error", (err) => {
        resolve({});
      });
  });
}

function classifyAssetType(ticker) {
  const upperTicker = ticker.toUpperCase();

  // Check known types
  if (KNOWN_TYPES[upperTicker]) {
    return KNOWN_TYPES[upperTicker];
  }

  // Check if it's a known ETF
  if (KNOWN_ETFS.includes(upperTicker)) {
    return "etf";
  }

  // Check for index indicators
  if (upperTicker.startsWith("^")) {
    return "index";
  }

  // Default to stock
  return "stock";
}

async function classifyAllAssets() {
  try {
    console.log("Fetching all active assets from Supabase...\n");

    const { data: activeAssets, error } = await supabase
      .from("assets")
      .select("id, ticker, name, sector, asset_type, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    console.log(`Found ${activeAssets.length} active assets\n`);
    console.log("Fetching sector data from Finnhub...\n");

    const updates = [];
    const summary = {
      total: activeAssets.length,
      updated: 0,
      notFound: 0,
      errors: 0,
      byType: {},
      bySector: {},
    };

    // Process in batches to respect rate limits (60/min)
    for (let i = 0; i < activeAssets.length; i++) {
      const asset = activeAssets[i];

      // Rate limiting: ~1 per second to stay well under 60/min
      if (i > 0 && i % 10 === 0) {
        await sleep(500);
      }

      // Determine asset type
      const classifiedType = classifyAssetType(asset.ticker);

      // Fetch from Finnhub if it's a stock
      let finnhubSector = null;
      if (classifiedType === "stock") {
        const profile = await fetchFromFinnhub(
          `/stock/profile2?symbol=${asset.ticker}`
        );

        if (profile && profile.finnhubIndustry) {
          // Map Finnhub industry to our sector categories
          finnhubSector = mapIndustryToSector(profile.finnhubIndustry);
        } else if (profile && profile.sector) {
          finnhubSector = profile.sector;
        }
      }

      const newSector =
        finnhubSector || classifyAsset(asset.ticker, asset.name);
      const needsUpdate =
        asset.asset_type !== classifiedType || asset.sector !== newSector;

      if (needsUpdate) {
        updates.push({
          id: asset.id,
          ticker: asset.ticker,
          name: asset.name,
          oldType: asset.asset_type,
          newType: classifiedType,
          oldSector: asset.sector,
          newSector: newSector,
        });

        summary.byType[classifiedType] = (summary.byType[classifiedType] || 0) + 1;
        summary.bySector[newSector] = (summary.bySector[newSector] || 0) + 1;
      }

      if ((i + 1) % 50 === 0) {
        process.stdout.write(`\rProcessed: ${i + 1}/${activeAssets.length}`);
      }
    }

    console.log("\n\n=== UPDATES TO BE APPLIED ===\n");
    console.log(`Total assets to update: ${updates.length}\n`);

    if (updates.length > 0) {
      console.log("Sample of updates (first 20):");
      updates.slice(0, 20).forEach((u) => {
        console.log(
          `  ${u.ticker.padEnd(8)} | ${u.name.substring(0, 30).padEnd(30)} | ${(u.newType || "stock").padEnd(20)} | ${u.newSector}`
        );
      });
      console.log("");
    }

    console.log("\nSummary by Asset Type:");
    Object.entries(summary.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} assets`);
    });

    console.log("\nSummary by Sector:");
    Object.entries(summary.bySector)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, count]) => {
        console.log(`  ${sector}: ${count} assets`);
      });

    if (updates.length === 0) {
      console.log("\n✓ No updates needed - all assets are correctly classified!");
      return;
    }

    console.log(
      `\n⚠️  Ready to update ${updates.length} assets. Applying updates...\n`
    );

    // Apply updates
    let successCount = 0;
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

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

      if ((i + 1) % 100 === 0) {
        process.stdout.write(
          `\rUpdating database: ${i + 1}/${updates.length}`
        );
      }
    }

    console.log("\n\n=== UPDATE COMPLETE ===");
    console.log(`✓ Successfully updated: ${successCount} assets`);
    if (summary.errors > 0) {
      console.log(`✗ Failed updates: ${summary.errors} assets`);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

// Map Finnhub industries to standard sectors
function mapIndustryToSector(industry) {
  const mappings = {
    "Basic Materials": "Materials",
    "Communication Services": "Communication Services",
    "Consumer Cyclical": "Consumer Discretionary",
    "Consumer Defensive": "Consumer Staples",
    Energy: "Energy",
    Financial: "Financials",
    "Financial Services": "Financials",
    Healthcare: "Healthcare",
    Industrials: "Industrials",
    "Real Estate": "Real Estate",
    Technology: "Information Technology",
    "Utilities": "Utilities",
  };

  return mappings[industry] || industry;
}

// Fallback classification
function classifyAsset(ticker, name) {
  const nameLower = (name || "").toLowerCase();

  const patterns = {
    pharma: "Healthcare",
    medical: "Healthcare",
    biotech: "Healthcare",
    drug: "Healthcare",
    hospital: "Healthcare",
    tech: "Information Technology",
    software: "Information Technology",
    semiconductor: "Information Technology",
    computer: "Information Technology",
    cloud: "Information Technology",
    bank: "Financials",
    financial: "Financials",
    insurance: "Financials",
    oil: "Energy",
    gas: "Energy",
    energy: "Energy",
    utility: "Utilities",
    power: "Utilities",
    retail: "Consumer Discretionary",
    restaurant: "Consumer Discretionary",
    food: "Consumer Staples",
    beverage: "Consumer Staples",
    airline: "Industrials",
    industrial: "Industrials",
    manufacturing: "Industrials",
    mining: "Materials",
    metal: "Materials",
    chemical: "Materials",
    telecom: "Communication Services",
    media: "Communication Services",
    entertainment: "Communication Services",
  };

  for (const [pattern, sector] of Object.entries(patterns)) {
    if (nameLower.includes(pattern)) {
      return sector;
    }
  }

  return "Other";
}

classifyAllAssets();
