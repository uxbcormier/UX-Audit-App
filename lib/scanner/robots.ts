// A small, dependency-free robots.txt parser — just enough to respect
// Disallow/Allow rules for our own user-agent and pick up any Sitemap:
// directives, without pulling in a full spec-complete library for what's a
// fairly small, well-defined piece of parsing.

const USER_AGENT_TOKEN = "grafterbot";

interface RobotsGroup {
  userAgents: string[];
  rules: { path: string; allow: boolean }[];
}

export interface RobotsRules {
  sitemapUrls: string[];
  // True if this path is allowed to be crawled under our user-agent's
  // rules (falling back to the "*" group when there's no agent-specific
  // one) — Disallow rules are checked longest-match-wins, per the de facto
  // standard every major crawler follows even though the original robots.txt
  // spec itself doesn't formally define a precedence rule.
  isAllowed(pathname: string): boolean;
}

function parseRobotsTxt(text: string): { groups: RobotsGroup[]; sitemapUrls: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemapUrls: string[] = [];
  let current: RobotsGroup | null = null;
  // A blank line (or a non-User-agent directive after rules) ends the
  // current group so the next User-agent line starts a fresh one, per the
  // standard "a group is a run of User-agent lines followed by rules" shape.
  let groupOpenForUserAgent = true;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const field = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (field === "sitemap") {
      if (value) sitemapUrls.push(value);
      continue;
    }

    if (field === "user-agent") {
      if (!groupOpenForUserAgent || !current) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      groupOpenForUserAgent = true;
      continue;
    }

    if (field === "disallow" || field === "allow") {
      groupOpenForUserAgent = false;
      if (!current) {
        current = { userAgents: ["*"], rules: [] };
        groups.push(current);
      }
      // An empty Disallow value means "disallow nothing" (i.e. allow
      // everything) per the standard.
      if (field === "disallow" && value === "") continue;
      current.rules.push({ path: value, allow: field === "allow" });
    }
  }

  return { groups, sitemapUrls };
}

function pathMatchesRule(pathname: string, rulePath: string): boolean {
  if (!rulePath) return false;
  // robots.txt wildcards: "*" matches any sequence, "$" anchors the end.
  const anchored = rulePath.endsWith("$");
  const withoutAnchor = anchored ? rulePath.slice(0, -1) : rulePath;
  const escaped = withoutAnchor.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const pattern = new RegExp(`^${escaped}${anchored ? "$" : ""}`);
  return pattern.test(pathname);
}

function selectGroup(groups: RobotsGroup[]): RobotsGroup | null {
  const specific = groups.find((g) => g.userAgents.includes(USER_AGENT_TOKEN));
  if (specific) return specific;
  return groups.find((g) => g.userAgents.includes("*")) ?? null;
}

export function parseRobots(text: string): RobotsRules {
  const { groups, sitemapUrls } = parseRobotsTxt(text);
  const group = selectGroup(groups);

  return {
    sitemapUrls,
    isAllowed(pathname: string): boolean {
      if (!group) return true;
      // Longest matching rule wins (the de facto standard); ties favor
      // Allow, which is the more permissive, conservative-for-the-site-owner
      // choice when a rule is genuinely ambiguous.
      let best: { path: string; allow: boolean } | null = null;
      for (const rule of group.rules) {
        if (!pathMatchesRule(pathname, rule.path)) continue;
        if (!best || rule.path.length > best.path.length) best = rule;
        else if (rule.path.length === best.path.length && rule.allow) best = rule;
      }
      return best ? best.allow : true;
    },
  };
}

// Fetches and parses robots.txt for a site. Never throws — a missing,
// unreachable, or malformed robots.txt is extremely common and just means
// "no restrictions and no extra sitemap hints," not a scan failure.
export async function fetchRobotsRules(baseUrl: string, timeoutMs = 5000): Promise<RobotsRules> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(robotsUrl, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) return parseRobots("");
      const text = await res.text();
      return parseRobots(text);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return parseRobots("");
  }
}
