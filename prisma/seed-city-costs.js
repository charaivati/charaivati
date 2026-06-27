// prisma/seed-city-costs.js
// Seeds CountryLivingCost from two Numbeo-format CSVs:
//   prisma/data/cost_of_living.csv  — 233 countries, Numbeo data in USD ("1.70 $")
//   prisma/data/DevelopmentData.csv — 166 countries, isDeveloping flag (0/1)
// Run: node prisma/seed-city-costs.js

// Uses pg directly — works regardless of prisma generate --no-engine state
const { Client } = require("pg");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

// Local currency per country (extend as needed)
const CURRENCIES = {
  India: "INR", China: "CNY", Japan: "JPY", Germany: "EUR",
  France: "EUR", Italy: "EUR", Spain: "EUR", Portugal: "EUR",
  "United States": "USD", "United Kingdom": "GBP", Canada: "CAD",
  Australia: "AUD", Brazil: "BRL", Russia: "RUB", Mexico: "MXN",
  Indonesia: "IDR", "South Africa": "ZAR", Nigeria: "NGN",
  Kenya: "KES", Ghana: "GHS", Bangladesh: "BDT", Pakistan: "PKR",
  "Sri Lanka": "LKR", Nepal: "NPR", Thailand: "THB", Vietnam: "VND",
  Malaysia: "MYR", Singapore: "SGD", Philippines: "PHP",
};

// Parse "1.70 $" or "1,234.56 $" → number
function parseDollar(str) {
  if (!str || typeof str !== "string") return null;
  const cleaned = str.replace(/[$,\s]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function splitCSVLine(line) {
  const cols = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseSimpleCSV(content) {
  const lines = content.split("\n").filter(l => l.trim());
  const headers = splitCSVLine(lines[0]);  // inQ-aware for quoted headers with commas
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  }).filter(r => r[headers[0]]);
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const colPath = path.join(__dirname, "data", "cost_of_living.csv");
  const devPath = path.join(__dirname, "data", "DevelopmentData.csv");

  if (!fs.existsSync(colPath)) {
    console.error(`Missing: ${colPath}`);
    process.exit(1);
  }

  // Load development flags
  const devMap = {};
  if (fs.existsSync(devPath)) {
    const devRows = parseSimpleCSV(fs.readFileSync(devPath, "utf-8"));
    for (const r of devRows) {
      const name = (r["CountryName"] || r["countryName"] || "").trim();
      const val  = r["Development"] ?? r["development"] ?? "";
      if (name) devMap[name] = val === "1";
    }
    console.log(`Loaded ${Object.keys(devMap).length} development flags`);
  }

  // Parse cost_of_living.csv
  const colRows = parseSimpleCSV(fs.readFileSync(colPath, "utf-8"));
  console.log(`Parsed ${colRows.length} country rows from cost_of_living.csv`);

  // Column name → field mapping (Numbeo headers)
  let seeded = 0, errors = 0;

  for (const row of colRows) {
    const country = (row["CountryName"] || row["countryName"] || "").trim();
    if (!country) continue;

    const data = {
      localCurrency: CURRENCIES[country] ?? "USD",
      isDeveloping:  devMap[country] ?? null,

      // 1BR outside centre
      rent1brOutUSD: parseDollar(row["Apartment (1 bedroom) Outside of Centre"]),
      // 1BR in city centre
      rent1brCtrUSD: parseDollar(row["Apartment (1 bedroom) in City Centre"]),
      // Cheap restaurant meal
      mealCheapUSD:  parseDollar(row["Meal, Inexpensive Restaurant"]),
      // Mid-range restaurant
      mealMidUSD:    parseDollar(row["Meal for 2 People, Mid-range Restaurant, Three-course"]),
      // Monthly public transport pass
      transportUSD:  parseDollar(row["Monthly Pass (Regular Price)"]) ??
                     parseDollar(row["Monthly Pass (Regular Transport)"]),
      // Basic utilities
      utilitiesUSD:  parseDollar(row["Basic (Electricity, Heating, Cooling, Water, Garbage) for 85m2 Apartment"]),
      // Internet
      internetUSD:   parseDollar(row["Internet (60 Mbps or More, Unlimited Data, Cable/ADSL)"]),
      // Average salary
      salaryUSD:     parseDollar(row["Average Monthly Net Salary (After Tax)"]),
    };

    try {
      await db.query(
        `INSERT INTO "CountryLivingCost"
          (id, country, "localCurrency", "isDeveloping",
           "rent1brOutUSD", "rent1brCtrUSD", "mealCheapUSD", "mealMidUSD",
           "transportUSD", "utilitiesUSD", "internetUSD", "salaryUSD", "fetchedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (country) DO UPDATE SET
           "localCurrency"=EXCLUDED."localCurrency",
           "isDeveloping"=EXCLUDED."isDeveloping",
           "rent1brOutUSD"=EXCLUDED."rent1brOutUSD",
           "rent1brCtrUSD"=EXCLUDED."rent1brCtrUSD",
           "mealCheapUSD"=EXCLUDED."mealCheapUSD",
           "mealMidUSD"=EXCLUDED."mealMidUSD",
           "transportUSD"=EXCLUDED."transportUSD",
           "utilitiesUSD"=EXCLUDED."utilitiesUSD",
           "internetUSD"=EXCLUDED."internetUSD",
           "salaryUSD"=EXCLUDED."salaryUSD",
           "fetchedAt"=NOW()`,
        [
          randomUUID(), country,
          data.localCurrency, data.isDeveloping ?? null,
          data.rent1brOutUSD, data.rent1brCtrUSD,
          data.mealCheapUSD, data.mealMidUSD,
          data.transportUSD, data.utilitiesUSD,
          data.internetUSD, data.salaryUSD,
        ]
      );
      seeded++;
    } catch (e) {
      console.error(`  Error seeding ${country}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nSeeded ${seeded} countries, ${errors} errors`);

  // Sanity check: India
  const res = await db.query(`SELECT * FROM "CountryLivingCost" WHERE country = 'India'`);
  const india = res.rows[0];
  if (india) {
    const rate = 83.5;
    console.log("\nIndia sanity check (USD → INR @ 83.5):");
    console.log(`  Rent 1BR outside: $${india.rent1brOutUSD} → ₹${Math.round((india.rent1brOutUSD ?? 0) * rate)}`);
    console.log(`  Cheap meal:       $${india.mealCheapUSD}  → ₹${Math.round((india.mealCheapUSD ?? 0) * rate)}`);
    console.log(`  Transport pass:   $${india.transportUSD}  → ₹${Math.round((india.transportUSD ?? 0) * rate)}`);
    console.log(`  Utilities:        $${india.utilitiesUSD}  → ₹${Math.round((india.utilitiesUSD ?? 0) * rate)}`);
    console.log(`  Internet:         $${india.internetUSD}   → ₹${Math.round((india.internetUSD ?? 0) * rate)}`);
    console.log(`  Avg salary:       $${india.salaryUSD}  → ₹${Math.round((india.salaryUSD ?? 0) * rate)}`);
  }

  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
