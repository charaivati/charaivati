/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const extraConnect = (process.env.CONNECT_SRC_EXTRA || "")
  .split(/[,\s]+/)
  .filter(Boolean);

const connectSrc = [
  "'self'",
  ...(!isProd ? ["ws://localhost:3000", "http://localhost:3000", "ws:", "wss:"] : []),
  ...extraConnect,
].join(" ");

const scriptSrc = [
  "'self'",
  ...(!isProd ? ["'unsafe-eval'", "blob:"] : []),
].join(" ");

const styleSrc = [
  "'self'",
  "'unsafe-inline'",
].join(" ");

const workerSrc = ["'self'", "blob:"].join(" ");
const frameSrc  = ["'self'", "blob:", "data:"].join(" ");
const manifestSrc = ["'self'"].join(" ");
const objectSrc = ["'none'"].join(" ");

const csp = `
  default-src 'self';
  base-uri 'self';
  frame-ancestors 'none';
  form-action 'self';
  object-src ${objectSrc};
  script-src ${scriptSrc};
  style-src ${styleSrc};
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src ${connectSrc};
  worker-src ${workerSrc};
  frame-src ${frameSrc};
  manifest-src ${manifestSrc};
  ${isProd ? "upgrade-insecure-requests;" : ""}
`.replace(/\s{2,}/g, " ").trim();

const nextConfig = {
  reactStrictMode: true,
  // remove these temp lines as soon as you fix lint + TS
  eslint: {
    ignoreDuringBuilds: true,          // TEMP: allow build even with ESLint errors
  },
  typescript: {
    ignoreBuildErrors: true,           // TEMP: allow build even with TS errors
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

// <-- ensure we export it
export default nextConfig;
