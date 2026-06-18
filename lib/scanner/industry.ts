import type { ScrapedPage } from "./scraper";

export const INDUSTRIES = [
  "Fashion & Apparel",
  "Beauty & Cosmetics",
  "Home & Garden",
  "Electronics & Tech",
  "Food & Beverage",
  "Health & Wellness",
  "Sporting Goods & Outdoor",
  "Jewelry & Accessories",
  "General Ecommerce",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// Minimum keyword hits required before we trust a classification over the
// "General Ecommerce" default — a single stray match isn't enough signal.
const MIN_MATCH_SCORE = 2;

const KEYWORD_PATTERNS: Record<Exclude<Industry, "General Ecommerce">, RegExp> = {
  "Fashion & Apparel":
    /\b(clothing|apparel|dress(es)?|shirts?|jeans|footwear|shoes|sneakers|fashion|outfits?|wardrobe|menswear|womenswear|activewear)\b/gi,
  "Beauty & Cosmetics":
    /\b(skincare|makeup|cosmetics?|beauty|fragrances?|perfume|serum|moisturizer|lipstick|haircare)\b/gi,
  "Home & Garden":
    /\b(furniture|home decor|bedding|kitchenware|garden|patio|appliances?|mattress|rugs?|houseware)\b/gi,
  "Electronics & Tech":
    /\b(electronics?|gadgets?|laptops?|smartphones?|headphones?|chargers?|wireless|bluetooth|software|tech accessor(y|ies))\b/gi,
  "Food & Beverage":
    /\b(snacks?|coffee|tea|organic food|groceries|grocery|beverages?|wine|recipes?|gourmet|nutrition)\b/gi,
  "Health & Wellness":
    /\b(supplements?|vitamins?|wellness|fitness|yoga|workouts?|protein|cbd|sleep aid)\b/gi,
  "Sporting Goods & Outdoor":
    /\b(outdoor gear|camping|hiking|sporting goods|cycling|bikes?|fishing|hunting|athletic)\b/gi,
  "Jewelry & Accessories":
    /\b(jewelry|jewellery|necklaces?|bracelets?|earrings?|rings?|watches|accessories)\b/gi,
};

// Classifies a scanned page into a rough industry bucket using keyword
// frequency in the page's own text — no external data, just what the site
// says about itself. Title/meta/headings count for more than body copy
// since they're a more deliberate signal of what the site sells.
export function detectIndustry(page: ScrapedPage): Industry {
  const bodyText = page.$("body").text().slice(0, 5000);
  const weightedText = [
    page.title,
    page.title,
    page.metaDescription,
    page.metaDescription,
    ...page.h1s,
    ...page.h2s,
    bodyText,
  ].join(" ");

  let bestIndustry: Industry = "General Ecommerce";
  let bestScore = 0;

  for (const [industry, pattern] of Object.entries(KEYWORD_PATTERNS) as [Industry, RegExp][]) {
    const matches = weightedText.match(pattern);
    const score = matches ? matches.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIndustry = industry;
    }
  }

  return bestScore >= MIN_MATCH_SCORE ? bestIndustry : "General Ecommerce";
}
