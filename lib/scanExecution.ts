import { prisma } from "./prisma";
import { runFullScan } from "./scanner";
import { ScrapeError } from "./scanner/scraper";
import { getIndustryBenchmark } from "./scanner/benchmark";
import {
  advanceJob,
  completeJob,
  failJob,
  recordScannedPages,
  scanStatusForJob,
  startJobAttempt,
} from "./scanJob";

// The single execution path for a scan, shared by the initial run
// (app/api/scan/route.ts) and a manual retry (app/api/scan/[id]/retry/
// route.ts) — one implementation, so a retry can't drift from what the
// first attempt does. Never touches Payment: a scan's execution and its
// payment are fully decoupled (the report just gates on Payment.status),
// so re-running this can't duplicate a charge.
export async function executeScan(scanId: string, url: string): Promise<void> {
  try {
    await startJobAttempt(scanId);
    await advanceJob(scanId, "CRAWLING", "crawling");

    const { teaser, full } = await runFullScan(url);

    await advanceJob(scanId, "ANALYZING", "computing benchmark");
    const benchmark = await getIndustryBenchmark(teaser.industry, teaser.overallScore);
    teaser.benchmark = benchmark;
    full.benchmark = benchmark;

    // Upserted by (scanId, url) — a retry re-recording the same pages
    // updates these rows instead of duplicating them.
    await recordScannedPages(scanId, full.pagesInspected);

    // Stage 1 still only ever visits a homepage and (optionally) one
    // product page — "partial" here means the product page specifically
    // couldn't be found/scanned, not a crawl-budget cutoff (there's no
    // crawl yet to cut off). Stage 2's real crawler will give this a
    // richer, budget-aware meaning.
    const partial = !full.productPageScanned;
    const job = await completeJob(scanId, { partial });

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: scanStatusForJob(job.status),
        teaserResults: teaser as object,
        fullResults: full as object,
        overallScore: teaser.overallScore,
        // No server-computed dollar figure exists anymore — see the data
        // model rework notes in lib/scanner/revenue.ts. A directional
        // estimate only exists once the visitor supplies their real
        // revenue, which happens client-side and isn't persisted here.
        revenueLoss: null,
        industry: teaser.industry,
      },
    });
  } catch (err) {
    console.error("Scan failed:", err);
    const failureReason = err instanceof ScrapeError ? err.reason : "unreachable";
    const message = err instanceof Error ? err.message : String(err);
    const job = await failJob(scanId, message);

    await prisma.scan.update({
      where: { id: scanId },
      data: { status: scanStatusForJob(job.status), failureReason },
    });
  }
}
