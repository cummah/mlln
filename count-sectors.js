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

async function countSectors() {
  try {
    console.log("Fetching all active assets...\n");

    const { data: allAssets, error } = await supabase
      .from("assets")
      .select("sector, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    // Count unique sectors
    const sectorCounts = {};
    allAssets.forEach((asset) => {
      const sector = asset.sector || "NULL";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    console.log(`=== UNIQUE SECTOR LABELS ===\n`);
    console.log(`Total unique sectors: ${Object.keys(sectorCounts).length}\n`);

    // Sort by count
    Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, count]) => {
        console.log(`${sector.padEnd(45)} : ${count}`);
      });

  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

countSectors();
