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

const supabase = createClient(supabaseUrl, serviceRoleKey);

function fetchFromFinnhub(pathStr) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1${pathStr}&token=${finnhubKey}`;

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

async function analyzeAssets() {
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

    const analysis = {
      total: activeAssets.length,
      withFinnhubData: 0,
      withoutFinnhubData: 0,
      noAccess: 0,
      indices: 0,
      samples: {
        withData: [],
        withoutData: [],
        noAccess: [],
      },
    };

    for (let i = 0; i < activeAssets.length; i++) {
      const asset = activeAssets[i];

      if ((i + 1) % 100 === 0) {
        process.stdout.write(`\rChecking: ${i + 1}/${activeAssets.length}`);
      }

      const ticker = asset.ticker.toUpperCase();

      // Skip indices
      if (ticker.startsWith("^")) {
        analysis.indices++;
        continue;
      }

      const profile = await fetchFromFinnhub(
        `/stock/profile2?symbol=${asset.ticker}`
      );

      if (profile.error === "You don't have access to this resource.") {
        analysis.noAccess++;
        if (analysis.samples.noAccess.length < 5) {
          analysis.samples.noAccess.push({
            ticker: asset.ticker,
            name: asset.name,
            error: profile.error,
          });
        }
      } else if (profile.finnhubIndustry) {
        analysis.withFinnhubData++;
        if (analysis.samples.withData.length < 5) {
          analysis.samples.withData.push({
            ticker: asset.ticker,
            name: asset.name,
            industry: profile.finnhubIndustry,
            currentSector: asset.sector,
          });
        }
      } else {
        analysis.withoutFinnhubData++;
        if (analysis.samples.withoutData.length < 5) {
          analysis.samples.withoutData.push({
            ticker: asset.ticker,
            name: asset.name,
            currentSector: asset.sector,
          });
        }
      }

      // Rate limiting
      if ((i + 1) % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log("\n\n=== ANALYSIS RESULTS ===\n");
    console.log(`Total active assets: ${analysis.total}`);
    console.log(`  - With Finnhub data: ${analysis.withFinnhubData}`);
    console.log(`  - Without Finnhub data: ${analysis.withoutFinnhubData}`);
    console.log(`  - No access (mutual funds, etc): ${analysis.noAccess}`);
    console.log(`  - Indices (^VIX, etc): ${analysis.indices}`);

    console.log("\n=== Sample Assets WITH Finnhub Data ===");
    analysis.samples.withData.forEach((a) => {
      console.log(
        `${a.ticker.padEnd(8)} | ${a.name.substring(0, 30).padEnd(30)} | ${a.industry.padEnd(30)} | Current: ${a.currentSector}`
      );
    });

    console.log("\n=== Sample Assets WITHOUT Finnhub Data ===");
    analysis.samples.withoutData.forEach((a) => {
      console.log(
        `${a.ticker.padEnd(8)} | ${a.name.substring(0, 30).padEnd(30)} | Current sector: ${a.currentSector}`
      );
    });

    console.log("\n=== Sample Assets with NO ACCESS ===");
    analysis.samples.noAccess.forEach((a) => {
      console.log(`${a.ticker.padEnd(8)} | ${a.name.substring(0, 30).padEnd(30)} | Error: ${a.error}`);
    });
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

analyzeAssets();
