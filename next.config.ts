import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Downloaded datasets and local operator state are runtime inputs, never
  // deployment assets. Code dependencies remain traced and bundled normally.
  outputFileTracingExcludes: {
    "/*": [
      "./private/**/*",
      "./.git/**/*",
      "./.env*",
      "./.aws/**/*",
      "./.ssh/**/*",
      "./.codex/**/*",
      "./.agents/**/*",
      "./.netrc",
      "./.npmrc",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
