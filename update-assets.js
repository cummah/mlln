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

async function updateAssets() {
  try {
    console.log("Starting asset updates...\n");

    // Update 1: Change "Health Care" to "Healthcare"
    const { data: healthCareUpdate, error: healthCareError } = await supabase
      .from("assets")
      .update({ sector: "Healthcare" })
      .eq("sector", "Health Care");

    if (healthCareError) {
      console.error("Error updating Health Care:", healthCareError);
    } else {
      console.log(
        `✓ Updated "Health Care" to "Healthcare": ${healthCareUpdate?.length || 0} rows`
      );
    }

    // Update 2: Set sector to "ETF" where asset_type is "etf"
    const { data: etfUpdate, error: etfError } = await supabase
      .from("assets")
      .update({ sector: "ETF" })
      .eq("asset_type", "etf");

    if (etfError) {
      console.error("Error updating ETF assets:", etfError);
    } else {
      console.log(
        `✓ Updated ETF assets sector to "ETF": ${etfUpdate?.length || 0} rows`
      );
    }

    console.log("\n✓ All updates completed!");
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

updateAssets();
