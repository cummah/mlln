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

const finnhubKey = process.env.FINNHUB_API_KEY;

function fetchFromFinnhub(pathStr) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1${pathStr}&token=${finnhubKey}`;
    console.log(`\nFull URL: ${url}`);

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
        console.error("Error:", err);
        resolve({});
      });
  });
}

async function testTickers() {
  const tickers = ["AAPL", "MSFT", "GEHC", "PRWCX", "^VIX"];

  for (const ticker of tickers) {
    const data = await fetchFromFinnhub(`/stock/profile2?symbol=${ticker}`);
    console.log(`\n${ticker}:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

testTickers();
