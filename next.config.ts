import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio"],
  experimental: {
    // Allow longer scan timeouts on API routes
  },
};

export default nextConfig;
