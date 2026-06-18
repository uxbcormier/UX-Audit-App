import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio", "playwright-core", "playwright", "@sparticuz/chromium"],
  experimental: {
    // Allow longer scan timeouts on API routes
    // Disabled: persistent Turbopack cache writes inside `.next` can trigger
    // rebuild loops on machines where the project folder is synced by
    // iCloud/Dropbox/OneDrive (each cache write gets touched by the sync
    // client, which re-triggers the file watcher).
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
