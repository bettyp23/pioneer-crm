import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy is per-request (nonce) and is set
// in src/proxy.ts. See docs/security.md §8.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Every page in Pioneer OS is private and per-user, and nonce-based CSP needs
  // request-time rendering, so Cache Components stays off for now (decisions.md D-18).
  cacheComponents: false,
  poweredByHeader: false,
  // Dev-only badge; keep it clear of the sidebar user menu (bottom-left).
  devIndicators: { position: "bottom-right" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
