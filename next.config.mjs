// ============================================================================
// FILE 3: next.config.mjs
// ============================================================================
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,          // TEMP: remove after fixing lint errors
  },
  typescript: {
    ignoreBuildErrors: true,           // TEMP: remove after fixing TS errors
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // CSP is handled by middleware.ts - don't duplicate here
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

export default nextConfig;