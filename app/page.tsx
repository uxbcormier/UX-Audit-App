"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingDown, Shield, Zap, Star } from "lucide-react";

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
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-bold text-xl text-slate-900">
            UX<span className="text-indigo-600">Audit</span>
          </span>
          <span className="text-sm text-slate-500">Free ecommerce scan</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <TrendingDown size={14} />
          Find out how much revenue your store is leaking
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 max-w-3xl leading-tight mb-4">
          Is your ecommerce store losing money you don&apos;t know about?
        </h1>

        <p className="text-lg text-slate-600 max-w-xl mb-10">
          Enter your store URL and get a free UX score, estimated revenue loss,
          and your top conversion killers — in under 60 seconds.
        </p>

        {/* Scan form */}
        <form onSubmit={handleScan} className="w-full max-w-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="yourstore.com"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-base"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition whitespace-nowrap"
            >
              {loading ? "Scanning…" : "Scan My Store →"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 text-left">{error}</p>
          )}

          <p className="mt-3 text-sm text-slate-500">
            Free scan · No account required · Results in ~60 seconds
          </p>
        </form>
      </section>

      {/* What we check */}
      <section className="bg-white border-t border-slate-200 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-10">
            What gets audited
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Zap size={22} className="text-yellow-500" />,
                title: "Page Speed",
                desc: "Core Web Vitals, LCP, CLS, mobile performance score",
              },
              {
                icon: <Search size={22} className="text-blue-500" />,
                title: "SEO",
                desc: "Meta tags, headings, alt text, canonical URLs, HTTPS",
              },
              {
                icon: <Star size={22} className="text-indigo-500" />,
                title: "UX Best Practices",
                desc: "CTAs, navigation, search, mobile viewport, checkout friction",
              },
              {
                icon: <Shield size={22} className="text-green-500" />,
                title: "Trust & Conversion",
                desc: "Reviews, trust badges, return policy, contact info visibility",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2 p-5 rounded-xl border border-slate-200"
              >
                {item.icon}
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs Paid strip */}
      <section className="py-10 px-6 bg-slate-900 text-white text-center">
        <p className="text-slate-400 text-sm mb-3">What you get free</p>
        <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
          <span>✓ UX score (0–100)</span>
          <span>✓ Estimated annual revenue loss</span>
          <span>✓ Top 3 critical issues</span>
          <span>✓ Category breakdown</span>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 px-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} UXAudit · Built for ecommerce founders
      </footer>
    </main>
  );
}
