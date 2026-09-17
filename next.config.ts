import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio", "playwright-core", "playwright", "@sparticuz/chromium"],
  // `serverExternalPackages` keeps playwright-core's code from being bundled,
  // but Vercel's file tracer still decides which of its files get shipped
  // to the deployed function — and it misses non-code assets like
  // browsers.json that playwright-core reads at runtime even when an
  // explicit executablePath is provided, crashing every scan with
  // "Cannot find module '.../playwright-core/browsers.json'".
  // Keyed on both the specific route and a wildcard: the specific key is
  // the documented approach, but the wildcard is here too in case the
  // route-glob matching against this app-router route doesn't line up the
  // same way under Turbopack that the docs' webpack-era examples assume.
  outputFileTracingIncludes: {
    "/api/scan": ["./node_modules/playwright-core/**/*"],
    "/*": ["./node_modules/playwright-core/**/*"],
  },
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
