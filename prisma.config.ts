// prisma.config.ts
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

export default defineConfig({});

// Note: seed is now configured in package.json under "prisma": { "seed": "node prisma/seed.js" }
// Add this to your package.json if not already there:
// "prisma": {
//   "seed": "node prisma/seed.js"
// }