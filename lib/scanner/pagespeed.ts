export interface PageSpeedResult {
  performanceScore: number;
  lcp: number | null; // ms
  cls: number | null;
  fid: number | null; // ms
  ttfb: number | null; // ms
  fcp: number | null; // ms
  speedIndex: number | null;
  mobileScore: number;
  desktopScore: number;
}

export async function runPageSpeed(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const base = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

  async function fetchStrategy(strategy: "mobile" | "desktop") {
    const params = new URLSearchParams({ url, strategy, category: "performance" });
    if (apiKey) params.set("key", apiKey);
    const res = await fetch(`${base}?${params}`);
    if (!res.ok) throw new Error(`PageSpeed API error: ${res.status}`);
    return res.json();
  }

  const [mobile, desktop] = await Promise.all([
    fetchStrategy("mobile"),
    fetchStrategy("desktop"),
  ]);

  const audits = mobile.lighthouseResult?.audits ?? {};
  const categories = mobile.lighthouseResult?.categories ?? {};

  const metric = (id: string) => audits[id]?.numericValue ?? null;

  return {
    performanceScore: Math.round((categories.performance?.score ?? 0) * 100),
    mobileScore: Math.round((categories.performance?.score ?? 0) * 100),
    desktopScore: Math.round(
      (desktop.lighthouseResult?.categories?.performance?.score ?? 0) * 100
    ),
    lcp: metric("largest-contentful-paint"),
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    fid: metric("total-blocking-time"),
    ttfb: metric("server-response-time"),
    fcp: metric("first-contentful-paint"),
    speedIndex: metric("speed-index"),
  };
}
