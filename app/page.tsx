"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ShoppingCart, Shield, Zap, Globe, TrendingUp } from "lucide-react";

const SIGNALS = [
  {
    icon: <Globe size={20} />,
    title: "Search Visibility",
    desc: "Meta tags, headings, and structure that determine whether shoppers find you at all.",
  },
  {
    icon: <Search size={20} />,
    title: "Time-to-Product",
    desc: "How fast shoppers find what they came for — navigation, search, and page structure.",
  },
  {
    icon: <ShoppingCart size={20} />,
    title: "Add-to-Cart Friction",
    desc: "Whether your CTAs and purchase path are obvious, visible, and easy to act on.",
  },
  {
    icon: <Shield size={20} />,
    title: "Trust Reinforcement",
    desc: "Reviews, badges, policies, and the signals shoppers look for before entering card details.",
  },
  {
    icon: <Zap size={20} />,
    title: "Mobile Complexity",
    desc: "Load speed and mobile rendering quality, where most ecommerce traffic actually happens.",
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
    <main className="flex flex-col min-h-screen bg-neutral-950">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-bold text-xl text-neutral-100">
            UX<span className="text-teal-400">Audit</span>
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">Free UX scan</span>
            <Link
              href="/login"
              className="text-sm font-medium text-teal-400 hover:text-teal-300"
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-950/40 border border-teal-900/50 text-teal-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <TrendingUp size={14} />
          AI conversion intelligence for ecommerce
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-neutral-100 max-w-3xl leading-[1.1] mb-5 tracking-tight">
          Find the revenue hiding in your UX.
        </h1>

        <p className="text-lg text-neutral-400 max-w-xl mb-12">
          Get an instant UX score, a revenue opportunity estimate, and the
          conversion signals quietly costing you sales — for free, in under
          60 seconds.
        </p>

        {/* Scan form */}
        <form onSubmit={handleScan} className="w-full max-w-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="yourstore.com"
                className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-neutral-950 font-semibold rounded-xl transition whitespace-nowrap"
            >
              {loading ? "Scanning…" : "Get My UX Score →"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-400 text-left">{error}</p>
          )}

          <p className="mt-4 text-sm text-neutral-500">
            Free scan · No account required · Results in ~60 seconds
          </p>
        </form>

        <p className="mt-10 text-sm text-neutral-500">
          Average ecommerce site scores <span className="text-neutral-300 font-medium">72/100</span>.
          Top brands hit <span className="text-neutral-300 font-medium">85+</span>.
          {" "}Find out where you stand.
        </p>
      </section>

      {/* Conversion signals */}
      <section className="border-t border-neutral-800 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-400 text-center mb-3">
            What we detect
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-neutral-100 mb-12">
            Five conversion signals, scored in one scan
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {SIGNALS.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-3 p-5 rounded-xl border border-neutral-800 bg-neutral-900"
              >
                <span className="text-teal-400">{item.icon}</span>
                <h3 className="font-semibold text-neutral-100 text-sm">{item.title}</h3>
                <p className="text-sm text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs Paid strip */}
      <section className="py-10 px-6 border-t border-neutral-800 bg-neutral-900/40 text-center">
        <p className="text-neutral-500 text-sm mb-3">What you get free</p>
        <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-neutral-300">
          <span>✓ UX score (0–100)</span>
          <span>✓ Revenue opportunity estimate</span>
          <span>✓ 2 high-impact insights</span>
          <span>✓ Conversion signal summary</span>
        </div>
      </section>

      <footer className="border-t border-neutral-800 py-6 px-6 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} UXAudit · Built for ecommerce founders
      </footer>
    </main>
  );
}
