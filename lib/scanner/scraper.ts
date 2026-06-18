import * as cheerio from "cheerio";
import axios from "axios";

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

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const start = Date.now();

  const response = await axios.get(normalizedUrl, {
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; UXAuditBot/1.0; +https://uxaudit.io)",
    },
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const responseTimeMs = Date.now() - start;
  const html = response.data as string;
  const $ = cheerio.load(html);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const matchesBotBlockText = BOT_BLOCK_SIGNS.test(bodyText.slice(0, 2000));

  if (matchesBotBlockText || BOT_BLOCK_STATUSES.has(response.status)) {
    throw new ScrapeError(
      `${normalizedUrl} appears to be blocking automated requests (HTTP ${response.status}).`,
      "blocked"
    );
  }

  if (response.status >= 400) {
    throw new ScrapeError(
      `Received HTTP ${response.status} while fetching ${normalizedUrl}.`,
      "unreachable"
    );
  }

  if (bodyText.length < 100) {
    throw new ScrapeError(
      "The page came back with almost no visible content, which usually means it renders entirely via JavaScript we can't execute.",
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
    statusCode: response.status,
    responseTimeMs,
  };
}
