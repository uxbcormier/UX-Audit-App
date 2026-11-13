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
  wcagLanguageOfPage: {
    source: "W3C Web Content Accessibility Guidelines (WCAG 2.1)",
    title: "Understanding Success Criterion 3.1.1: Language of Page (Level A)",
    summary:
      "Requires the default human language of a page to be programmatically determinable (typically via the <html lang> attribute), so assistive technology like screen readers can select the correct pronunciation rules.",
    url: "https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html",
  },
  wcagLinkPurpose: {
    source: "W3C Web Content Accessibility Guidelines (WCAG 2.0/2.1)",
    title: "Understanding Success Criterion 2.4.4: Link Purpose (In Context)",
    summary:
      "Requires a link's purpose to be determinable from its link text alone (or its text plus programmatically-determined context) — vague text like 'click here' or 'read more' fails this for a screen-reader user tabbing through a page's links in isolation.",
    url: "https://www.w3.org/WAI/WCAG20/Understanding/link-purpose-in-context.html",
  },
  wcagNameRoleValue: {
    source: "W3C Web Content Accessibility Guidelines (WCAG 2.0/2.1)",
    title: "Understanding Success Criterion 4.1.2: Name, Role, Value",
    summary:
      "Requires every UI component (including form inputs, links, and buttons) to have a programmatically-determinable name, so assistive technology can describe it to the user — an input with no associated label, or a button with no accessible text, fails this.",
    url: "https://www.w3.org/WAI/WCAG20/Understanding/name-role-value",
  },
  wcagContrastMinimum: {
    source: "W3C Web Content Accessibility Guidelines (WCAG 2.1)",
    title: "Understanding Success Criterion 1.4.3: Contrast (Minimum, Level AA)",
    summary:
      "Requires a contrast ratio of at least 4.5:1 between text and its background (3:1 for large text), to keep text readable for people with low vision or color-vision deficiencies.",
    url: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum",
  },
  wcagTargetSize: {
    source: "W3C Web Content Accessibility Guidelines (WCAG 2.1)",
    title: "Understanding Success Criterion 2.5.5: Target Size (Enhanced)",
    summary:
      "WCAG's enhanced (AAA) guidance recommends touch targets be at least 44x44 CSS pixels, since smaller targets are measurably harder to tap accurately — this is best-practice guidance, not the mandatory AA-level requirement (which sets a lower 24x24px floor).",
    url: "https://www.w3.org/WAI/WCAG21/Understanding/target-size.html",
  },
} satisfies Record<string, ResearchCitation>;

export type ResearchKey = keyof typeof RESEARCH_LIBRARY;

export function cite(...keys: ResearchKey[]): ResearchCitation[] {
  return keys.map((k) => RESEARCH_LIBRARY[k]);
}
