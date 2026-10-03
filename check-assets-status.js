const { createClient } = require("@supabase/supabase-js");
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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAssets() {
  try {
    console.log("Checking asset status...\n");

    // Get total count
    const { count: totalCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true });

    console.log(`Total assets in database: ${totalCount}\n`);

    // Get active assets
    const { data: allAssets, error: error1 } = await supabase
      .from("assets")
      .select("id, ticker, name, asset_type, sector, is_active")
      .eq("is_active", true)
      .limit(100);

    if (error1) {
      console.error("Error fetching active assets:", error1);
      return;
    }

    console.log(`Active assets: ${allAssets.length}\n`);

    // Analyze asset_type distribution
    const typeStats = {};
    const sectorStats = {};
    let nullTypeCount = 0;
    let nullSectorCount = 0;

    allAssets.forEach((asset) => {
      if (!asset.asset_type) {
        nullTypeCount++;
      } else {
        typeStats[asset.asset_type] = (typeStats[asset.asset_type] || 0) + 1;
      }

      if (!asset.sector) {
        nullSectorCount++;
      } else {
        sectorStats[asset.sector] = (sectorStats[asset.sector] || 0) + 1;
      }
    });

    console.log("=== ASSET TYPE DISTRIBUTION ===");
    console.log(`NULL/Unclassified: ${nullTypeCount}`);
    Object.entries(typeStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

    console.log("\n=== SECTOR DISTRIBUTION ===");
    console.log(`NULL/Unclassified: ${nullSectorCount}`);
    Object.entries(sectorStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, count]) => {
        console.log(`  ${sector}: ${count}`);
      });

    console.log("\n=== SAMPLE ASSETS (first 10) ===");
    allAssets.slice(0, 10).forEach((asset) => {
      console.log(
        `${asset.ticker.padEnd(8)} | ${asset.name.substring(0, 25).padEnd(25)} | Type: ${(asset.asset_type || "NULL").padEnd(12)} | Sector: ${asset.sector || "NULL"}`
      );
    });

    if (nullTypeCount > 0 || nullSectorCount > 0) {
      console.log("\n=== SAMPLE UNCLASSIFIED ASSETS ===");
      const unclassified = allAssets.filter(
        (a) => !a.asset_type || !a.sector
      );
      unclassified.slice(0, 10).forEach((asset) => {
        console.log(
          `${asset.ticker.padEnd(8)} | ${asset.name.substring(0, 25).padEnd(25)} | Type: ${(asset.asset_type || "NULL").padEnd(12)} | Sector: ${asset.sector || "NULL"}`
        );
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

checkAssets();
