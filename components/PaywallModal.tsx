"use client";

import { useState } from "react";
import { X, CheckCircle, Lock } from "lucide-react";

interface Props {
  scanId: string;
  highImpactCount: number;
  totalIssues: number;
  onClose: () => void;
}

export default function PaywallModal({ scanId, highImpactCount, totalIssues, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-paper border border-stone max-w-md w-full p-8 z-10">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-text hover:text-ink">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 border border-forest/40 flex items-center justify-center mx-auto mb-3">
            <Lock size={22} className="text-forest" />
          </div>
          <h2 className="font-display text-2xl text-ink mb-1">Unlock Your Full Report</h2>
          <p className="text-stone-text text-sm">
            {totalIssues} findings detected ·{" "}
            <strong className="text-rust">{highImpactCount} high-impact</strong> opportunit
            {highImpactCount === 1 ? "y" : "ies"}
          </p>
        </div>

        {/* What you get */}
        <div className="bg-white border border-stone p-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-text mb-3">What&apos;s included</p>
          <ul className="flex flex-col gap-2">
            {[
              `All ${totalIssues} findings with full evidence and behavioral context`,
              "Step-by-step recommendations for every finding",
              "Full Business Impact Area breakdown",
              "Priority recommendations ranked by impact",
              "Shareable report link",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-ink">
                <CheckCircle size={15} className="text-forest shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Email + CTA */}
        <form onSubmit={handleCheckout}>
          <label className="block text-sm font-medium text-ink mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourstore.com"
            className="w-full px-4 py-2.5 bg-white border border-stone mb-4 text-ink placeholder:text-stone-text focus:outline-none focus:border-ink text-sm"
            disabled={loading}
            required
          />

          {error && <p className="text-rust text-sm mb-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ink hover:bg-forest disabled:opacity-60 text-paper font-semibold transition-colors text-lg"
          >
            {loading ? "Redirecting…" : "Get Full Report — $129"}
          </button>

          <p className="text-center text-xs text-stone-text mt-3">
            Secure payment via Stripe · 30-day money-back guarantee
          </p>
        </form>
      </div>
    </div>
  );
}
