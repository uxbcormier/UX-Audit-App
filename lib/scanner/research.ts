// A small, curated library of real, well-established UX/CRO research,
// referenced by individual checks via key. Each entry supports a *general*
// principle (e.g. "visible trust signals correlate with higher checkout
// completion in usability studies") — never a specific claim about this
// scanned site's own conversion rate or revenue. Checks attach these via
// `researchContext` only when the underlying claim is genuinely backed by
// published research; everything else is labeled an internal heuristic
// instead (see `sourceLabel` on AuditIssue).
import type { ResearchCitation } from "./types";

export const RESEARCH_LIBRARY = {
  nngHeuristics: {
    source: "Nielsen Norman Group",
    title: "10 Usability Heuristics for User Interface Design",
    summary:
      "Foundational usability research establishing that visibility of system status and a clear, recognizable next action meaningfully affect how easily people complete tasks on a page.",
    url: "https://www.nngroup.com/articles/ten-usability-heuristics/",
  },
  hicksLaw: {
    source: "Hick's Law (Hick, 1952; Hyman, 1953)",
    title: "Choice and Reaction Time",
    summary:
      "Long-established psychology research showing decision time increases with the number of choices presented — the basis for 'choice overload' effects on pages with many competing calls-to-action.",
    // The 1952/1953 papers themselves aren't freely URL-accessible; this
    // points to a stable secondary reference that accurately describes the
    // finding and its origin, consistent with how it's cited above.
    url: "https://en.wikipedia.org/wiki/Hick%27s_law",
  },
  baymardPDP: {
    source: "Baymard Institute",
    title: "User Reviews Section (ecommerce PDP usability research)",
    summary:
      "Baymard's usability testing found the large majority of shoppers rely on the reviews section when evaluating a product, often more than the product description itself.",
    url: "https://baymard.com/ecommerce-design-examples/44-user-reviews-section",
  },
  baymardCheckout: {
    source: "Baymard Institute",
    title: "How to Reduce Cart Abandonment (Data-Backed UX Strategies)",
    summary:
      "Baymard's checkout research found extra costs revealed late in checkout (shipping, taxes, fees) to be the single most commonly cited reason for cart abandonment.",
    url: "https://baymard.com/learn/reduce-cart-abandonment",
  },
  webVitals: {
    source: "web.dev (Google)",
    title: "Core Web Vitals",
    summary:
      "Google's published performance research defines thresholds (e.g. LCP, CLS) correlated with real-user experience quality, and uses them as a search ranking signal.",
    url: "https://web.dev/articles/vitals",
  },
} satisfies Record<string, ResearchCitation>;

export type ResearchKey = keyof typeof RESEARCH_LIBRARY;

export function cite(...keys: ResearchKey[]): ResearchCitation[] {
  return keys.map((k) => RESEARCH_LIBRARY[k]);
}
