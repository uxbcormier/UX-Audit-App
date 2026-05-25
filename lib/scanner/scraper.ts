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
