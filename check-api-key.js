const fs = require("fs");
const path = require("path");

// Load .env.local manually
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");

console.log("=== .env.local CONTENTS ===\n");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length > 0) {
    const value = rest.join("=").trim();
    const masked = value.substring(0, 10) + "..." + (value.length > 10 ? value.substring(value.length - 5) : "");
    console.log(`${key.trim()} = ${masked}`);
    process.env[key.trim()] = value;
  }
});

console.log("\n=== ENVIRONMENT VARIABLES ===\n");
console.log(`ANTHROPIC_API_KEY set: ${process.env.ANTHROPIC_API_KEY ? "YES" : "NO"}`);
if (process.env.ANTHROPIC_API_KEY) {
  const key = process.env.ANTHROPIC_API_KEY;
  console.log(`  Length: ${key.length}`);
  console.log(`  Starts with: ${key.substring(0, 10)}`);
  console.log(`  Ends with: ${key.substring(key.length - 5)}`);
}

console.log(`\nSUPABASE_URL set: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "YES" : "NO"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "YES" : "NO"}`);
