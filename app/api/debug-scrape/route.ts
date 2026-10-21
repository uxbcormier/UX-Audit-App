import { NextRequest, NextResponse } from "next/server";
import { launchScanSession, scrapeWithContext } from "@/lib/scanner/scraper";
import { findProductLink, findShopLink } from "@/lib/scanner/productDiscovery";
import { looksLikeSingleProductPage } from "@/lib/scanner/checks/product";
import { normalizedBodyText } from "@/lib/scanner/normalize";

// TEMPORARY debug-only endpoint for diagnosing the product-page scraping
// pipeline directly (as JSON in the browser) without needing to dig through
// Vercel's log UI. Remove once the false "no Add to Cart" finding is
// root-caused and fixed. Not linked from the app; GET-only, read-only.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Pass ?url=https://example.com" }, { status: 400 });
  }

  const { browser, context } = await launchScanSession();
  try {
    const homepage = await scrapeWithContext(context, url, {
      waitForNetworkIdle: true,
      captureScreenshot: false,
    });

    let productUrl = findProductLink(homepage, url);
    let viaShop: string | null = null;

    if (!productUrl) {
      const shopUrl = findShopLink(homepage, url);
      if (shopUrl) {
        viaShop = shopUrl;
        const shopPage = await scrapeWithContext(context, shopUrl, {
          waitForNetworkIdle: false,
          captureScreenshot: false,
          navTimeoutMs: 8000,
        });
        productUrl = findProductLink(shopPage, shopUrl);
      }
    }

    if (!productUrl) {
      return NextResponse.json({
        homepageUrl: url,
        viaShop,
        productUrl: null,
        note: "No product link was discovered from the homepage (or shop page). The scan never reached a PDP.",
      });
    }

    const productPage = await scrapeWithContext(context, productUrl, {
      waitForNetworkIdle: true,
      captureScreenshot: false,
      navTimeoutMs: 10000,
    });

    const text = normalizedBodyText(productPage);
    const isSingleProductPage = looksLikeSingleProductPage(productPage);

    return NextResponse.json({
      homepageUrl: url,
      viaShop,
      productUrl,
      isSingleProductPage,
      statusCode: productPage.statusCode,
      htmlLength: productPage.html.length,
      bodyTextLength: text.length,
      containsBagWord: /bag/i.test(text),
      containsCartWord: /cart/i.test(text),
      containsBuyWord: /buy/i.test(text),
      buttonLikeElementCount: productPage.$(
        'a, button, input[type="submit"], input[type="button"], [role="button"]'
      ).length,
      // Every button/link-like element's own text + aria-label/value, so we
      // can see exactly what labels actually exist in the rendered DOM.
      candidateElementLabels: productPage
        .$('a, button, input[type="submit"], input[type="button"], [role="button"]')
        .map((_, el) => {
          const $el = productPage.$(el);
          const label = [$el.text(), $el.attr("aria-label") ?? "", $el.attr("value") ?? ""]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          return label;
        })
        .get()
        .filter((label) => label.length > 0)
        .slice(0, 80),
      bodyTextSample: text.slice(0, 6000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  } finally {
    await browser.close();
  }
}
