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

const anthropicKey = process.env.ANTHROPIC_API_KEY;

console.log("=== API KEY VALIDATION ===\n");
console.log(`API Key Present: ${anthropicKey ? "YES" : "NO"}`);
console.log(`API Key Length: ${anthropicKey?.length || 0}`);
console.log(`API Key Format: ${anthropicKey?.startsWith("sk-ant-") ? "VALID (sk-ant- prefix)" : "INVALID (missing sk-ant- prefix)"}`);

if (anthropicKey) {
  console.log(`\nTesting API connection...\n`);

  // Simple test call to verify the key works
  const data = JSON.stringify({
    model: "claude-opus-4-7",
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content: "Hi",
      },
    ],
  });

  const options = {
    hostname: "api.anthropic.com",
    port: 443,
    path: "/v1/messages",
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
      console.log(`Status: ${res.statusCode}`);
      console.log(`Response:`, body.substring(0, 200));

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log("\n✓ API Key is VALID");
      } else if (res.statusCode === 401) {
        console.log("\n✗ API Key is INVALID or EXPIRED");
      } else {
        console.log(`\n? Unexpected status code: ${res.statusCode}`);
      }
    });
  });

  req.on("error", (err) => {
    console.error("Connection error:", err.message);
  });

  req.write(data);
  req.end();
} else {
  console.log("\n✗ API Key not found in .env.local");
}
