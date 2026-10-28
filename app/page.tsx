"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const AUDIT_AREAS = [
  {
    num: "01",
    title: "Product Discovery",
    desc: "Navigation, search, and page structure that determine whether shoppers find what they came for.",
  },
  {
    num: "02",
    title: "PDP Purchase Readiness",
    desc: "Whether the path from product page to cart is obvious, visible, and free of friction.",
  },
  {
    num: "03",
    title: "Trust Coverage",
    desc: "The reviews, policies, and signals shoppers look for before entering payment details.",
  },
  {
    num: "04",
    title: "Mobile & Performance",
    desc: "Load speed and mobile rendering quality, where most ecommerce traffic actually happens.",
  },
  {
    num: "05",
    title: "Decision Complexity",
    desc: "Whether the page offers one clear next step, or forces shoppers to choose among too many.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    let scanUrl = url.trim();
    if (!scanUrl) return;
    if (!/^https?:\/\//i.test(scanUrl)) scanUrl = `https://${scanUrl}`;

    setLoading(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scanUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/scan/${data.scanId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-paper text-ink">
      {/* Nav */}
      <nav className="rule px-6 py-5 border-b border-stone">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-display text-xl tracking-tight">GRAFTER</span>
          <div className="flex items-center gap-6">
            <span className="text-sm text-stone-text hidden sm:inline">
              Start free. No signup required.
            </span>
            <Link href="/login" className="text-sm font-medium border-b border-ink pb-0.5">
              Log in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col px-6 pt-20 pb-24 max-w-5xl mx-auto w-full">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rust mb-6">
          Ecommerce UX Audit
        </p>

        <h1 className="font-display text-5xl sm:text-7xl leading-[0.98] tracking-tight max-w-3xl mb-8">
          Find what&rsquo;s holding your store back.
        </h1>

        <p className="text-lg text-stone-text max-w-xl mb-12 leading-relaxed">
          An evidence-led ecommerce audit that shows you what needs attention,
          why it matters, and what to fix first.
        </p>

        {/* Scan form */}
        <form onSubmit={handleScan} className="w-full max-w-xl">
          <div className="flex flex-col sm:flex-row gap-0 sm:gap-3 border border-ink sm:border-0">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourstore.com"
              className="flex-1 px-4 py-4 bg-white border-b sm:border border-stone text-ink placeholder:text-stone-text focus:outline-none focus:border-ink text-base"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-7 py-4 bg-ink hover:bg-forest disabled:opacity-50 text-paper font-semibold transition-colors whitespace-nowrap"
            >
              {loading ? "Auditing…" : "Audit your store"}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-rust text-left">{error}</p>}

          <p className="mt-4 text-sm text-stone-text">
            Start free. No signup required.
          </p>
        </form>
      </section>

      {/* Audit areas */}
      <section className="border-t border-stone py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rust mb-3">
            What we audit
          </p>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-14 max-w-xl">
            Five areas, scored from verified evidence.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5">
            {AUDIT_AREAS.map((item, i) => (
              <div
                key={item.title}
                className={`py-6 pr-6 border-t border-stone ${
                  i > 0 ? "sm:border-l sm:pl-6" : ""
                }`}
              >
                <span className="font-mono text-xs text-stone-text">{item.num}</span>
                <h3 className="font-display text-lg mt-2 mb-2">{item.title}</h3>
                <p className="text-sm text-stone-text leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs Paid strip */}
      <section className="py-14 px-6 border-t border-stone bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-stone-text text-sm mb-4">Included free, every scan</p>
          <div className="flex flex-wrap gap-x-10 gap-y-2 text-sm font-medium">
            <span>UX score, 0–100</span>
            <span>Two full findings with evidence</span>
            <span>Count of high-impact issues found</span>
            <span>Above-the-fold screenshot</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone py-8 px-6 text-center text-sm text-stone-text">
        © {new Date().getFullYear()} Grafter · An evidence-led ecommerce audit
      </footer>
    </main>
  );
}
