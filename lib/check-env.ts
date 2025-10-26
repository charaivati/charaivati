// scripts/check-env.ts
/**
 * Simple environment validation to run in CI or at server start to fail early if required envs are missing.
 * Usage: node ./dist/scripts/check-env.js OR ts-node scripts/check-env.ts in CI
 */

const requiredInProd = [
  "NEXT_PUBLIC_SITE_URL",
  "DATABASE_URL",
  "JWT_SECRET",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_FROM",
];

function missingEnvVars(list: string[]) {
  return list.filter((k) => !process.env[k]);
}

if (process.env.NODE_ENV === "production") {
  const missing = missingEnvVars(requiredInProd);
  if (missing.length) {
    console.error("Missing required environment variables for production:", missing.join(", "));
    process.exit(1);
  }
} else {
  const optional = ["NEXT_PUBLIC_SITE_URL"];
  const missing = missingEnvVars(optional);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn("Optional env vars not set (dev):", missing.join(", "));
  }
}

process.exit(0);
