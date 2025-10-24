/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Add extra connect targets via env (comma-separated)
// e.g. CONNECT_SRC_EXTRA="https://plausible.io https://api.stripe.com"
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
  ...(!isProd ? ["'unsafe-eval'", "blob:"] : []), // ← add blob: for dev
].join(" ");

const styleSrc = [
  "'self'",
  "'unsafe-inline'", // keep until you move styles to files or hashes
].join(" ");

const workerSrc = ["'self'", "blob:"].join(" ");   // ← new
const frameSrc  = ["'self'", "blob:", "data:"].join(" "); // ← new
const manifestSrc = ["'self'"].join(" ");
const objectSrc = ["'none'"].join(" "); // hardening

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
         // { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Redundant with frame-ancestors, but OK if you want: keep or remove either one.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
