import * as cheerio from "cheerio";
import type { Browser } from "playwright-core";

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

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const start = Date.now();

  const browser = await launchBrowser();

  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    let response;
    try {
      response = await page.goto(normalizedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    } catch {
      throw new ScrapeError(`Could not reach ${normalizedUrl}.`, "unreachable");
    }

    // Give late-loading content (lazy images, hydration, deferred scripts) a
    // brief window without waiting indefinitely on sites that never go fully
    // idle (chat widgets, analytics beacons, etc).
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

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
    };
  } finally {
    await browser.close();
  }
}
