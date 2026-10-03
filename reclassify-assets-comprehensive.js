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
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicKey) {
  console.error("Error: ANTHROPIC_API_KEY not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function callAnthropicAPI(requests) {
  return new Promise((resolve, reject) => {
    // Create proper batch request with requests array
    const payload = {
      requests: requests,
    };
    const data = JSON.stringify(payload);

    console.log(`\nRequest size: ${data.length} bytes`);

    const options = {
      hostname: "api.anthropic.com",
      port: 443,
      path: "/v1/messages/batches",
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

function callAnthropicAPIGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.anthropic.com",
      port: 443,
      path: path,
      method: "GET",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

const SYSTEM_PROMPT = `You are a financial asset classification expert specializing in comprehensive asset taxonomy.

Your task is to classify financial assets using OFFICIAL, INDUSTRY-STANDARD classifications. DO NOT force assets into GICS sectors.

Classification rules:

ASSET TYPES (pick the most accurate):
- Stock (common equity shares)
- ETF (exchange-traded fund)
- Mutual Fund (mutual fund, not ETF)
- Bond (fixed income securities)
- Treasury (US government bonds)
- Index (market index like S&P 500, VIX)
- Commodity (gold, oil, metals, agriculture)
- Forex (currency pairs)
- Cryptocurrency (digital assets)
- REIT (real estate investment trust)
- Preferred Stock (preferred equity)
- Option (derivatives)
- Future (derivatives)
- Other

CLASSIFICATION APPROACH:
- For STOCKS: Use GICS Sector (11 main sectors) and GICS Industry Group
- For ETFs: Use the fund's PRIMARY objective/strategy (equity, fixed income, commodity, real estate, etc.)
- For MUTUAL FUNDS: Use standard fund classification (growth, value, income, balanced, international, sector-specific, etc.)
- For BONDS: Use bond type (corporate, government, municipal, high-yield, etc.) and rating category if identifiable
- For INDICES: Use "Index" as asset type, classify by what it tracks (equity index, volatility index, commodity index, etc.)
- For REITS: Use REIT type (equity REIT, mortgage REIT, etc.)
- For COMMODITIES: Use commodity type (precious metals, energy, agriculture, etc.)

Your response MUST be valid JSON with these fields:
{
  "asset_type": "<primary type from list above>",
  "classification": "<detailed official classification based on asset type>"
}

Examples:
- Apple stock: {"asset_type": "Stock", "classification": "Information Technology | Semiconductors & Semiconductor Equipment"}
- SPY ETF: {"asset_type": "ETF", "classification": "Equity ETF - US Large Cap"}
- TLT Bond ETF: {"asset_type": "ETF", "classification": "Fixed Income ETF - US Treasuries"}
- Corporate Bond: {"asset_type": "Bond", "classification": "Corporate Bond - Investment Grade"}
- Treasury Bond: {"asset_type": "Treasury", "classification": "US Treasury Bond"}
- ^VIX Index: {"asset_type": "Index", "classification": "Volatility Index - Equity Market"}
- GLD Commodity: {"asset_type": "ETF", "classification": "Commodity ETF - Precious Metals"}

Be specific and use official industry classifications. Your classification field should reflect what the asset actually is.`;

async function createBatchRequests(assets) {
  const requests = [];

  for (const asset of assets) {
    const userPrompt = `Classify this financial asset using official industry-standard classifications (not forced into GICS):

Ticker: ${asset.ticker}
Name: ${asset.name}
Current Classification:
  - Type: ${asset.asset_type || "unknown"}
  - Sector: ${asset.sector || "unknown"}

Provide accurate, official classification for what this asset actually is. Use the most appropriate classification system for this asset type.

Return ONLY valid JSON.`;

    requests.push({
      custom_id: `asset-${asset.id}`,
      params: {
        model: "claude-opus-4-7",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      },
    });
  }

  return requests;
}

async function submitBatch(requests) {
  console.log(`\nSubmitting batch with ${requests.length} requests...`);

  // Split into smaller batches if needed (Anthropic has size limits)
  const maxBatchSize = 100000; // chars
  const batches = [];
  let currentBatch = [];
  let currentSize = 0;

  for (const request of requests) {
    const requestStr = JSON.stringify(request);
    const size = Buffer.byteLength(requestStr);

    if (currentSize + size > maxBatchSize && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [request];
      currentSize = size;
    } else {
      currentBatch.push(request);
      currentSize += size;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  console.log(`Splitting into ${batches.length} batch(es)...`);

  // Submit first batch for now
  const response = await callAnthropicAPI(batches[0]);

  if (response.error) {
    throw new Error(`API Error: ${response.error.message}`);
  }

  console.log(`✓ Batch submitted successfully`);
  console.log(`  Batch ID: ${response.id}`);
  console.log(`  Status: ${response.processing_status}`);

  return response;
}

async function pollBatchStatus(batchId) {
  console.log(`\nPolling batch status (ID: ${batchId})...`);

  let isComplete = false;
  let pollCount = 0;
  const maxPolls = 720; // 12 hours with 60-second intervals

  while (!isComplete && pollCount < maxPolls) {
    pollCount++;

    const response = await callAnthropicAPIGet(`/v1/messages/batches/${batchId}`);

    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`);
    }

    const processedCount = response.request_counts?.processed || 0;
    const totalRequests = response.request_counts?.total || 1;

    process.stdout.write(
      `\r  Progress: ${processedCount}/${totalRequests} (${Math.round(
        (processedCount / totalRequests) * 100
      )}%) | Status: ${response.processing_status}`
    );

    if (response.processing_status === "ended") {
      isComplete = true;
      console.log("\n✓ Batch processing complete");
      return response;
    }

    // Wait 10 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  if (!isComplete) {
    throw new Error("Batch processing timeout");
  }
}

async function processBatchResults(batchId) {
  console.log(`\nRetrieving results from batch...`);

  const resultsUrl = `/v1/messages/batches/${batchId}/results`;
  const response = await callAnthropicAPIGet(resultsUrl);

  if (response.error) {
    throw new Error(`API Error: ${response.error.message}`);
  }

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  // Parse streaming results
  const lines = response.toString().split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const result = JSON.parse(line);

      if (result.result?.message?.content?.[0]?.text) {
        const customId = result.custom_id;
        const assetId = customId.replace("asset-", "");

        try {
          const classification = JSON.parse(result.result.message.content[0].text);

          results.push({
            assetId: assetId,
            assetType: classification.asset_type,
            classification: classification.classification,
            success: true,
          });
          successCount++;
        } catch (parseError) {
          console.error(`Failed to parse classification for ${customId}`);
          results.push({
            assetId: assetId,
            success: false,
            error: "Failed to parse response",
          });
          errorCount++;
        }
      }
    } catch (e) {
      // Skip non-JSON lines
    }
  }

  console.log(
    `✓ Processed ${successCount} successful classifications, ${errorCount} errors`
  );

  return results;
}

async function updateSupabase(results) {
  console.log(`\nUpdating Supabase with ${results.length} reclassifications...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (!result.success) {
      errorCount++;
      continue;
    }

    try {
      const { error } = await supabase
        .from("assets")
        .update({
          asset_type: result.assetType,
          sector: result.classification,
        })
        .eq("id", result.assetId);

      if (error) {
        console.error(`Error updating asset ${result.assetId}:`, error);
        errorCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      console.error(`Error updating asset ${result.assetId}:`, e);
      errorCount++;
    }

    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r  Updated: ${i + 1}/${results.length}`);
    }
  }

  console.log(`\n✓ Successfully updated ${successCount} assets, ${errorCount} errors`);

  return { successCount, errorCount };
}

async function reclassifyAllAssets() {
  try {
    console.log("=== COMPREHENSIVE ASSET RECLASSIFICATION ===\n");
    console.log("Fetching all active assets from Supabase...");

    // Fetch ALL active assets
    const { data: allAssets, error } = await supabase
      .from("assets")
      .select("id, ticker, name, asset_type, sector, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    console.log(`✓ Found ${allAssets.length} active assets to reclassify`);

    if (allAssets.length === 0) {
      console.log("No active assets found!");
      return;
    }

    // Create batch requests
    const requests = await createBatchRequests(allAssets);

    // Submit batch
    const batch = await submitBatch(requests);

    // Poll for completion
    const completedBatch = await pollBatchStatus(batch.id);

    // Process results
    const results = await processBatchResults(batch.id);

    // Update Supabase
    const updateStats = await updateSupabase(results);

    console.log("\n=== RECLASSIFICATION COMPLETE ===");
    console.log(`Total assets processed: ${allAssets.length}`);
    console.log(`Successfully reclassified: ${updateStats.successCount}`);
    console.log(`Errors: ${updateStats.errorCount}`);

  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

reclassifyAllAssets();
