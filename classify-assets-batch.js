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

// Classification taxonomy
const ASSET_TYPES = ["stock", "etf", "bond", "fund", "index", "crypto", "commodity", "forex"];
const SECTORS = [
  "Information Technology",
  "Healthcare",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
  "Communication Services",
  "Other"
];

function callAnthropicAPI(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: "api.anthropic.com",
      port: 443,
      path: "/v1/messages/batches",
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": data.length,
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

const SYSTEM_PROMPT = `You are a financial asset classification expert. Your task is to classify assets by type and sector.

ASSET TYPES: stock, etf, bond, fund, index, crypto, commodity, forex

SECTORS:
- Information Technology
- Healthcare
- Financials
- Consumer Discretionary
- Consumer Staples
- Industrials
- Energy
- Utilities
- Real Estate
- Materials
- Communication Services
- Other

For each asset, analyze the ticker symbol and name to determine:
1. Asset type - choose from the list above
2. Sector - choose from the list above

Be conservative and accurate. If you cannot determine the sector with confidence, use "Other".

Respond with a JSON object with exactly these fields:
{
  "asset_type": "<type>",
  "sector": "<sector>"
}`;

async function createBatchRequests(assets) {
  const requests = [];

  for (const asset of assets) {
    const userPrompt = `Classify this financial asset:
Ticker: ${asset.ticker}
Name: ${asset.name}

Return only valid JSON.`;

    requests.push({
      custom_id: `asset-${asset.id}`,
      params: {
        model: "claude-opus-4-7",
        max_tokens: 200,
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

  const response = await callAnthropicAPI({
    requests: requests,
  });

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
    const totalRequests = response.request_counts?.total || requests.length;

    process.stdout.write(`\r  Progress: ${processedCount}/${totalRequests} (${Math.round((processedCount/totalRequests)*100)}%) | Status: ${response.processing_status}`);

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
  const lines = response.toString().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const result = JSON.parse(line);

      if (result.result?.message?.content?.[0]?.text) {
        const customId = result.custom_id;
        const assetId = customId.replace('asset-', '');

        try {
          const classification = JSON.parse(result.result.message.content[0].text);

          results.push({
            assetId: assetId,
            assetType: classification.asset_type,
            sector: classification.sector,
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

  console.log(`✓ Processed ${successCount} successful classifications, ${errorCount} errors`);

  return results;
}

async function updateSupabase(results) {
  console.log(`\nUpdating Supabase with ${results.length} classifications...`);

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
          sector: result.sector,
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

async function classifyAssetsWithBatch() {
  try {
    console.log("=== BATCH ASSET CLASSIFICATION ===\n");
    console.log("Fetching unclassified assets from Supabase...");

    // Fetch unclassified assets
    const { data: unclassifiedAssets, error } = await supabase
      .from("assets")
      .select("id, ticker, name, is_active")
      .or("asset_type.is.null,sector.is.null")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    console.log(`✓ Found ${unclassifiedAssets.length} unclassified assets`);

    if (unclassifiedAssets.length === 0) {
      console.log("No unclassified assets found!");
      return;
    }

    // Create batch requests
    const requests = await createBatchRequests(unclassifiedAssets);

    // Submit batch
    const batch = await submitBatch(requests);

    // Poll for completion
    const completedBatch = await pollBatchStatus(batch.id);

    // Process results
    const results = await processBatchResults(batch.id);

    // Update Supabase
    const updateStats = await updateSupabase(results);

    console.log("\n=== CLASSIFICATION COMPLETE ===");
    console.log(`Total assets processed: ${unclassifiedAssets.length}`);
    console.log(`Successfully classified: ${updateStats.successCount}`);
    console.log(`Errors: ${updateStats.errorCount}`);

  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

classifyAssetsWithBatch();
