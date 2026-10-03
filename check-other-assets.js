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

async function checkOtherAssets() {
  try {
    console.log("Fetching 'Other' classified assets...\n");

    const { data: otherAssets, error } = await supabase
      .from("assets")
      .select("id, ticker, name, asset_type, sector, is_active")
      .eq("is_active", true)
      .eq("sector", "Other");

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    console.log(`Total 'Other' assets: ${otherAssets.length}\n`);

    // Analyze asset types
    const typeStats = {};
    otherAssets.forEach((asset) => {
      const type = asset.asset_type || "Unknown";
      typeStats[type] = (typeStats[type] || 0) + 1;
    });

    console.log("=== ASSET TYPES IN 'OTHER' ===");
    Object.entries(typeStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

    console.log("\n=== SAMPLE 'OTHER' ASSETS (first 20) ===");
    otherAssets.slice(0, 20).forEach((asset) => {
      console.log(
        `${asset.ticker.padEnd(8)} | ${asset.name.substring(0, 35).padEnd(35)} | Type: ${(asset.asset_type || "unknown").padEnd(15)}`
      );
    });

  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

checkOtherAssets();
