import Module from "node:module";
import path from "node:path";
import bundledBrowsersJson from "./playwright-browsers.json";

// playwright-core reads its own browsers.json internally via a plain
// `require(path.join(packageRoot, "browsers.json"))` the moment any
// browser is launched — even when an explicit executablePath is passed —
// so it has to exist on disk regardless of how the browser binary itself
// is located. On Vercel this file has repeatedly failed to make it into
// the deployed function bundle (tried fixing it via next.config.ts's
// outputFileTracingIncludes first; confirmed via the trace locally, but
// the production crash persisted), crashing every single scan.
//
// The deployed bundle is read-only outside /tmp, so we can't just write
// the real file back into node_modules at runtime. Instead, this patches
// Node's own module loader to serve a copy of the file's content —
// bundled directly into our own source tree, which Next.js's tracer has
// no ambiguity about including — whenever the real one 404s.
let patched = false;

export function ensurePlaywrightBrowsersJsonFallback(): void {
  if (patched) return;
  patched = true;

  type ModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
  const moduleWithLoad = Module as unknown as { _load: ModuleLoad };
  const originalLoad = moduleWithLoad._load;

  moduleWithLoad._load = function patchedLoad(request, parent, isMain) {
    try {
      return originalLoad.call(this, request, parent, isMain);
    } catch (err) {
      const isMissingPlaywrightBrowsersJson =
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND" &&
        path.basename(request) === "browsers.json" &&
        request.includes("playwright-core");
      if (isMissingPlaywrightBrowsersJson) return bundledBrowsersJson;
      throw err;
    }
  };
}
