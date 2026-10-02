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
  },
  baymardPDP: {
    source: "Baymard Institute",
    title: "Product Page & Ecommerce UX Research",
    summary:
      "Large-scale ecommerce usability testing has repeatedly found that shoppers look for reviews and clear product-level information before adding an item to cart.",
    url: "https://baymard.com/",
  },
  baymardCheckout: {
    source: "Baymard Institute",
    title: "Checkout Usability & Cart Abandonment Research",
    summary:
      "Baymard's checkout research is well known for identifying unexpected shipping costs and unclear return terms as among the most commonly cited reasons shoppers abandon a cart.",
    url: "https://baymard.com/",
  },
  trustSignalsGeneral: {
    source: "Baymard Institute",
    title: "Ecommerce Trust & Credibility Research",
    summary:
      "Research on new-visitor trust finds that visible security/payment badges, accessible policies, and social proof are among the signals shoppers use to judge a store's legitimacy before buying.",
    url: "https://baymard.com/",
  },
  googleMobileSpeed: {
    source: "Google",
    title: "Mobile Page Speed Industry Benchmarks",
    summary:
      "Google's published research into mobile page load times found abandonment rates rise sharply as load time increases, particularly past the 3-second mark.",
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
