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
    const payload = {
      requests: requests,
    };
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

const EXISTING_SECTORS = [
  "Information Technology",
  "Energy",
  "Financials",
  "Health Care",
  "Retail",
  "Utilities",
  "Life Sciences Tools & Services",
  "Real Estate",
  "Healthcare",
  "Machinery",
  "Electrical Equipment",
  "Media",
  "Consumer Staples",
  "Industrials",
  "Biotechnology",
  "Chemicals",
  "Communication Services",
  "Insurance",
  "Semiconductors",
  "Pharmaceuticals",
  "Textiles, Apparel & Luxury Goods",
  "Hotels, Restaurants & Leisure",
  "Consumer products",
  "Construction",
  "Aerospace & Defense",
  "Banking",
  "Road & Rail",
  "Trading Companies & Distributors",
  "Commercial Services & Supplies",
  "Professional Services",
  "Consumer Discretionary",
  "Building",
  "Logistics & Transportation",
  "Auto Components",
  "Telecommunication",
  "Materials"
];

const SYSTEM_PROMPT = `You are a financial sector classification expert. Your task is to classify stocks into their industry group based on their primary business.

You MUST choose from ONLY these existing sector categories (these are standardized GICS industry groups):

${EXISTING_SECTORS.map((s, i) => `${i + 1}. ${s}`).join("\n")}

For each stock:
1. Analyze the company name and what they likely do
2. Find the BEST matching category from the list above
3. Make your best judgment - do NOT use "Other"

Return ONLY valid JSON:
{
  "sector": "<exact sector name from list above>"
}`;

async function createBatchRequests(assets) {
  const requests = [];

  for (const asset of assets) {
    const userPrompt = `Classify this stock into one of the existing sector categories:

Ticker: ${asset.ticker}
Company Name: ${asset.name}

Choose the BEST matching category from the provided list. Make your best judgment based on the company name and business type. Do not return "Other".

Return ONLY the JSON classification.`;

    requests.push({
      custom_id: `asset-${asset.id}`,
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: 100,
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

  const payload = {
    requests: requests,
  };
  const data = JSON.stringify(payload);

  console.log(`Request payload size: ${Buffer.byteLength(data)} bytes`);

  const response = await callAnthropicAPI(requests);

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
  const maxPolls = 720;

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
            sector: classification.sector,
            success: true,
          });
          successCount++;
        } catch (parseError) {
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
  console.log(`\nUpdating Supabase with ${results.length} sector reclassifications...`);

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

async function reclassifyOtherAssets() {
  try {
    console.log("=== RECLASSIFYING 'OTHER' ASSETS ===\n");
    console.log("Fetching assets classified as 'Other'...");

    const { data: otherAssets, error } = await supabase
      .from("assets")
      .select("id, ticker, name, is_active")
      .eq("is_active", true)
      .eq("sector", "Other");

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    console.log(`✓ Found ${otherAssets.length} 'Other' assets`);

    if (otherAssets.length === 0) {
      console.log("No 'Other' assets to reclassify!");
      return;
    }

    // Create batch requests
    const requests = await createBatchRequests(otherAssets);

    // Submit batch
    const batch = await submitBatch(requests);

    // Poll for completion
    const completedBatch = await pollBatchStatus(batch.id);

    // Process results
    const results = await processBatchResults(batch.id);

    // Update Supabase
    const updateStats = await updateSupabase(results);

    console.log("\n=== RECLASSIFICATION COMPLETE ===");
    console.log(`Total assets processed: ${otherAssets.length}`);
    console.log(`Successfully reclassified: ${updateStats.successCount}`);
    console.log(`Errors: ${updateStats.errorCount}`);

  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

reclassifyOtherAssets();
