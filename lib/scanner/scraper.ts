import * as cheerio from "cheerio";
import type { Browser, BrowserContext } from "playwright-core";

export interface ScrapedPage {
  html: string;
  $: ReturnType<typeof cheerio.load>;
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
  images: { src: string; alt: string; hasAlt: boolean }[];
  links: { href: string; text: string }[];
  hasSSL: boolean;
  statusCode: number;
  responseTimeMs: number;
  // Above-the-fold screenshot as a data URL, for display in the report.
  // Null if the capture failed or wasn't requested for this page.
  screenshotDataUrl: string | null;
}

// Phrases that show up on bot-block / challenge pages instead of real content.
const BOT_BLOCK_SIGNS =
  /access denied|attention required|are you a (human|robot)|pardon our interruption|captcha|just a moment|checking your browser|request unsuccessful|blocked by network security/i;

// Status codes commonly returned by anti-bot services (Cloudflare, Akamai, etc.)
// when they've identified and rejected automated traffic.
const BOT_BLOCK_STATUSES = new Set([403, 429, 503]);

export type ScrapeFailureReason = "blocked" | "unreachable" | "empty";

export class ScrapeError extends Error {
  reason: ScrapeFailureReason;

  constructor(message: string, reason: ScrapeFailureReason) {
    super(message);
    this.name = "ScrapeError";
    this.reason = reason;
  }
}

const USER_AGENT = "Mozilla/5.0 (compatible; UXAuditBot/1.0; +https://uxaudit.io)";

// `@sparticuz/chromium`'s bundled binary is built for Lambda-style Linux and
// won't run on a developer's Mac/Windows machine, so production and local
// dev launch the browser two different ways.
async function launchBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwrightChromium } = await import("playwright-core");
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { chromium: localChromium } = await import("playwright");
  return localChromium.launch({ headless: true });
}

// A scan visits more than one page (homepage, and often a product page), but
// they should all share a single browser launch rather than paying that cost
// per page. Callers must close `browser` when done with the whole scan.
export async function launchScanSession(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
  });
  return { browser, context };
}

interface ScrapeOptions {
  // The homepage gets a generous load wait and a screenshot; secondary pages
  // (e.g. a discovered product page) use a lighter touch so one slow or
  // unreachable extra page can't eat the route's time budget.
  waitForNetworkIdle?: boolean;
  captureScreenshot?: boolean;
  navTimeoutMs?: number;
}

export async function scrapeWithContext(
  context: BrowserContext,
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapedPage> {
  const { waitForNetworkIdle = true, captureScreenshot = true, navTimeoutMs = 20000 } = options;
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const start = Date.now();

  const page = await context.newPage();
  try {
    let response;
    try {
      response = await page.goto(normalizedUrl, {
        waitUntil: "domcontentloaded",
        timeout: navTimeoutMs,
      });
    } catch {
      throw new ScrapeError(`Could not reach ${normalizedUrl}.`, "unreachable");
    }

    // Give late-loading content (lazy images, hydration, deferred scripts) a
    // brief window without waiting indefinitely on sites that never go fully
    // idle (chat widgets, analytics beacons, etc).
    if (waitForNetworkIdle) {
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    }

    const responseTimeMs = Date.now() - start;
    const status = response?.status() ?? 0;
    const html = await page.content();
    const $ = cheerio.load(html);

    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const matchesBotBlockText = BOT_BLOCK_SIGNS.test(bodyText.slice(0, 2000));

    if (matchesBotBlockText || BOT_BLOCK_STATUSES.has(status)) {
      throw new ScrapeError(
        `${normalizedUrl} appears to be blocking automated requests (HTTP ${status}).`,
        "blocked"
      );
    }

    if (status >= 400) {
      throw new ScrapeError(`Received HTTP ${status} while fetching ${normalizedUrl}.`, "unreachable");
    }

    if (bodyText.length < 100) {
      throw new ScrapeError(
        "The page came back with almost no visible content, even after rendering it in a real browser.",
        "empty"
      );
    }

    // Above-the-fold only (not full-page) — keeps the capture fast and the
    // resulting data URL small enough to store inline with the rest of the
    // scan results. A failed screenshot shouldn't fail the whole scan.
    const screenshotDataUrl = captureScreenshot
      ? await page
          .screenshot({ type: "jpeg", quality: 60 })
          .then((buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`)
          .catch(() => null)
      : null;

    const images = $("img")
      .map((_, el) => ({
        src: $(el).attr("src") ?? "",
        alt: $(el).attr("alt") ?? "",
        hasAlt: Boolean($(el).attr("alt")),
      }))
      .get();

    const links = $("a")
      .map((_, el) => ({
        href: $(el).attr("href") ?? "",
        text: $(el).text().trim(),
      }))
      .get();

    return {
      html,
      $,
      title: $("title").text().trim(),
      metaDescription: $('meta[name="description"]').attr("content") ?? "",
      h1s: $("h1").map((_, el) => $(el).text().trim()).get(),
      h2s: $("h2").map((_, el) => $(el).text().trim()).get(),
      images,
      links,
      hasSSL: normalizedUrl.startsWith("https"),
      statusCode: status,
      responseTimeMs,
      screenshotDataUrl,
    };
  } finally {
    await page.close();
  }
}

// Convenience wrapper for callers that only need a single page and don't
// want to manage the browser session themselves.
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const { browser, context } = await launchScanSession();
  try {
    return await scrapeWithContext(context, url);
  } finally {
    await browser.close();
  }
}
