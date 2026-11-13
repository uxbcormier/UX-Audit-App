import * as cheerio from "cheerio";
import type { Browser, BrowserContext } from "playwright-core";
import { ensurePlaywrightBrowsersJsonFallback } from "./playwrightBrowsersJsonFallback";

// A single interactive element's REAL rendered state, read from inside the
// live browser (via page.evaluate) rather than guessed from static HTML
// attributes. This is what makes visibility/disabled detection trustworthy:
// cheerio has no layout engine, so it can't know whether an element with no
// inline `display:none` is actually on-screen (CSS from a stylesheet, a
// parent's `overflow:hidden`, JS-toggled classes, etc. are all invisible to
// it). Computed here, after the page has rendered, there's no guessing.
export interface InteractiveElementEvidence {
  tag: string;
  text: string;
  ariaLabel: string | null;
  role: string | null;
  type: string | null;
  href: string | null;
  disabled: boolean;
  visible: boolean;
  classes: string;
  testId: string | null;
}

// Real computed visibility of H1 elements, read the same way as
// InteractiveElementEvidence — cheerio's h1s[] below (plain .text() content)
// can't distinguish "no H1 anywhere in the DOM" from "an H1 exists but is
// visually hidden" (display:none, a mobile-only duplicate, a skip-link
// style visually-hidden-but-accessible heading, etc). Both are real, but
// they're different findings with different severity.
export interface HeadingAudit {
  h1Count: number;
  visibleH1Count: number;
}

export interface ScrapedPage {
  html: string;
  $: ReturnType<typeof cheerio.load>;
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
  images: { src: string; alt: string; hasAlt: boolean; isDecorative: boolean; isMissingAlt: boolean }[];
  links: { href: string; text: string }[];
  hasSSL: boolean;
  statusCode: number;
  responseTimeMs: number;
  // Above-the-fold screenshot as a data URL, for display in the report.
  // Null if the capture failed or wasn't requested for this page.
  screenshotDataUrl: string | null;
  // Real in-browser inventory of interactive elements, or null if the
  // in-page evaluation itself failed (page navigated away, crashed, etc).
  // Checks MUST treat null here as "this page's evidence is incomplete,"
  // never as "no interactive elements exist" — those are different facts.
  interactiveElements: InteractiveElementEvidence[] | null;
  // Real computed H1 visibility, or null on the same evaluation-failure
  // condition as interactiveElements. See HeadingAudit.
  headingAudit: HeadingAudit | null;
  // True when this page's DOM capture is as complete as the scraper can
  // make it (interactiveElements !== null). Any check whose finding is
  // "X was NOT found anywhere on the page" should treat false here as a
  // reason to withhold that definitive claim — an incomplete capture can't
  // prove absence, only that nothing was found in what WAS captured. This
  // is the same evidence-quality signal purchaseAction.ts uses, applied
  // generally rather than just to the Add to Cart check.
  evidenceComplete: boolean;
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

const USER_AGENT = "Mozilla/5.0 (compatible; GrafterBot/1.0; +https://grafter.app)";

// Trips some basic anti-bot heuristics that block any automated browser on
// sight, independent of the (honest, self-identifying) User-Agent above —
// e.g. a naive check for `navigator.webdriver`. This doesn't hide who we
// are — the UA above still identifies GrafterBot for any site owner who
// wants to allowlist it — it just avoids the crudest "is this Playwright"
// tells that would block us before that identity is even considered.
const STEALTH_LAUNCH_ARGS = ["--disable-blink-features=AutomationControlled"];

// The full `@sparticuz/chromium` package bundles its ~67MB browser binary
// inside node_modules, and Vercel's build repeatedly failed to carry that
// binary into the deployed function (same underlying class of bug as the
// playwright-core browsers.json issue above, just too large to work around
// by bundling a copy into our own source tree). `chromium-min` ships no
// binary at all — it downloads this exact matching release build to /tmp
// on cold start instead, sidestepping the bundler/tracing problem
// entirely. Only the first invocation after a cold start pays this
// download cost; warm invocations reuse the extracted /tmp copy.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

// `@sparticuz/chromium-min`'s resolved binary is built for Lambda-style
// Linux and won't run on a developer's Mac/Windows machine, so production
// and local dev launch the browser two different ways.
async function launchBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "production") {
    ensurePlaywrightBrowsersJsonFallback();
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const { chromium: playwrightChromium } = await import("playwright-core");
    return playwrightChromium.launch({
      args: [...chromium.args, ...STEALTH_LAUNCH_ARGS],
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
  }

  const { chromium: localChromium } = await import("playwright");
  return localChromium.launch({ headless: true, args: STEALTH_LAUNCH_ARGS });
}

// A scan visits more than one page (homepage, and often a product page), but
// they should all share a single browser launch rather than paying that cost
// per page. Callers must close `browser` when done with the whole scan.
export async function launchScanSession(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  // Playwright leaves `navigator.webdriver` set to true by default, which is
  // the single most common automated-browser tell — some sites block on
  // this alone before anything else is even checked.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
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

    // Read before page.content(): this runs inside the live, rendered page
    // so disabled/visible reflect real computed state (getBoundingClientRect
    // + computed style), not static attribute guessing. A failure here
    // (navigation mid-evaluate, detached frame) shouldn't fail the whole
    // scrape — it just means later checks must treat this page's purchase-
    // action evidence as incomplete rather than confidently absent.
    const liveEvidence = await page
      .evaluate(() => {
        const isVisible = (el: Element): boolean => {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const isDisabled = (el: Element): boolean => {
          const anyEl = el as HTMLButtonElement | HTMLInputElement;
          if (typeof anyEl.disabled === "boolean" && anyEl.disabled) return true;
          if (el.getAttribute("aria-disabled") === "true") return true;
          return el.closest("fieldset[disabled]") !== null;
        };
        const els = Array.from(
          document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
        );
        const interactiveElements = els.map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
          ariaLabel: el.getAttribute("aria-label"),
          role: el.getAttribute("role"),
          type: el.getAttribute("type"),
          href: el.getAttribute("href"),
          disabled: isDisabled(el),
          visible: isVisible(el),
          classes: typeof el.className === "string" ? el.className : "",
          testId: el.getAttribute("data-testid"),
        }));

        const h1Els = Array.from(document.querySelectorAll("h1"));
        const headingAudit = {
          h1Count: h1Els.length,
          visibleH1Count: h1Els.filter(isVisible).length,
        };

        return { interactiveElements, headingAudit };
      })
      .catch(() => null);

    const interactiveElements = liveEvidence?.interactiveElements ?? null;
    const headingAudit = liveEvidence?.headingAudit ?? null;

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
      .map((_, el) => {
        const $el = $(el);
        const altAttr = $el.attr("alt");
        const role = ($el.attr("role") ?? "").toLowerCase();
        // alt="" (attribute present but empty) is the standard, correct way
        // to mark an image as decorative — that is NOT a missing-alt
        // violation, it's a deliberate accessibility choice. Only the
        // attribute being absent entirely (or the image being otherwise
        // marked decorative via role/aria-hidden) should NOT count as a
        // violation either; a true violation is an absent alt attribute on
        // an image that isn't marked decorative by any other means.
        const isDecorative =
          altAttr === "" || role === "presentation" || role === "none" || $el.attr("aria-hidden") === "true";
        const isMissingAlt = altAttr === undefined && !isDecorative;
        return {
          src: $el.attr("src") ?? "",
          alt: altAttr ?? "",
          hasAlt: altAttr !== undefined,
          isDecorative,
          isMissingAlt,
        };
      })
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
      interactiveElements,
      headingAudit,
      evidenceComplete: interactiveElements !== null,
    };
  } finally {
    await page.close();
  }
}

// Real rendered-mobile-viewport evidence, captured the same way as
// InteractiveElementEvidence above (page.evaluate against a live render) —
// never guessed from the desktop-viewport capture, since layout at 375px
// can differ completely from layout at 1280px (that's the whole point of a
// dedicated mobile check). Null means the capture itself failed (navigation
// error, crashed page, timeout) — checks must treat that as "mobile
// evidence unavailable," never as "no mobile issues found."
export interface MobileRenderAudit {
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  hasHorizontalOverflow: boolean;
  totalVisibleTapTargets: number;
  undersizedTapTargetCount: number;
  totalBodyTextSamples: number;
  smallBodyTextSampleCount: number;
}

// iPhone SE's logical viewport — the smallest common real device width still
// in active use, so a layout that fits here fits everything larger too.
const MOBILE_VIEWPORT = { width: 375, height: 667 };

// WCAG 2.5.5's enhanced ("AAA") target-size guidance, not the mandatory
// AA-level 24x24 (SC 2.5.8) — see research.ts's citation for this, which
// phrases it as best-practice guidance rather than a compliance claim.
const MIN_TAP_TARGET_PX = 44;

// Below this, body copy becomes genuinely hard to read on a phone without
// zooming — a widely-used mobile-readability floor, not a cited standard
// (hence internal-heuristic sourcing on the check that uses this).
const MIN_READABLE_FONT_PX = 12;

// Opens its own short-lived mobile-viewport context rather than reusing the
// scan's shared desktop context (viewport is fixed per-context in
// Playwright) — closed before returning either way. Any failure (bad URL,
// navigation timeout, crashed page) returns null rather than throwing, so
// one failed mobile capture never fails the whole scan.
export async function captureMobileRenderAudit(
  browser: Browser,
  url: string
): Promise<MobileRenderAudit | null> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: MOBILE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
    });
    const page = await context.newPage();

    try {
      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch {
      return null;
    }
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const evidence = await page.evaluate(
      ({ minTapTargetPx, minReadableFontPx }) => {
        const isVisible = (el: Element): boolean => {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const tapTargets = Array.from(
          document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
        ).filter(isVisible);
        const undersizedTapTargetCount = tapTargets.filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width < minTapTargetPx || rect.height < minTapTargetPx;
        }).length;

        // Sample leaf text-bearing elements (no element children) rather than
        // every element, so a wrapping <div> doesn't get counted alongside
        // the <p>/<span> actually rendering the text inside it.
        const textEls = Array.from(document.querySelectorAll("p, span, li, a, button, div")).filter(
          (el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0 && isVisible(el)
        );
        const smallBodyTextSampleCount = textEls.filter(
          (el) => parseFloat(window.getComputedStyle(el).fontSize) < minReadableFontPx
        ).length;

        return {
          scrollWidth: document.documentElement.scrollWidth,
          totalVisibleTapTargets: tapTargets.length,
          undersizedTapTargetCount,
          totalBodyTextSamples: textEls.length,
          smallBodyTextSampleCount,
        };
      },
      { minTapTargetPx: MIN_TAP_TARGET_PX, minReadableFontPx: MIN_READABLE_FONT_PX }
    );

    return {
      viewportWidth: MOBILE_VIEWPORT.width,
      viewportHeight: MOBILE_VIEWPORT.height,
      scrollWidth: evidence.scrollWidth,
      hasHorizontalOverflow: evidence.scrollWidth > MOBILE_VIEWPORT.width,
      totalVisibleTapTargets: evidence.totalVisibleTapTargets,
      undersizedTapTargetCount: evidence.undersizedTapTargetCount,
      totalBodyTextSamples: evidence.totalBodyTextSamples,
      smallBodyTextSampleCount: evidence.smallBodyTextSampleCount,
    };
  } catch {
    return null;
  } finally {
    await context?.close().catch(() => {});
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
