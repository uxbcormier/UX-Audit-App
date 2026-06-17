"use client";

import { useState } from "react";
import { X, CheckCircle, Lock } from "lucide-react";

interface Props {
  scanId: string;
  revenueLoss: number;
  totalIssues: number;
  onClose: () => void;
}

export default function PaywallModal({ scanId, revenueLoss, totalIssues, onClose }: Props) {
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
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-8 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-teal-950/50 border border-teal-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock size={22} className="text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-100 mb-1">
            Unlock Your Full Report
          </h2>
          <p className="text-neutral-400 text-sm">
            {totalIssues} insights found · Est.{" "}
            <strong className="text-red-400">${revenueLoss.toLocaleString()}/yr</strong> leaking
          </p>
        </div>

        {/* What you get */}
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            What&apos;s included
          </p>
          <ul className="flex flex-col gap-2">
            {[
              `All ${totalIssues} insights with full behavioral breakdowns`,
              "Step-by-step fix instructions for every issue",
              "Revenue impact estimate per issue",
              "Priority recommendations ranked by impact",
              "Shareable report link",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-neutral-300">
                <CheckCircle size={15} className="text-teal-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Email + CTA */}
        <form onSubmit={handleCheckout}>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourstore.com"
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl mb-4 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            disabled={loading}
            required
          />

          {error && (
            <p className="text-red-400 text-sm mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-neutral-950 font-bold rounded-xl transition text-lg"
          >
            {loading ? "Redirecting…" : "Get Full Report — $129"}
          </button>

          <p className="text-center text-xs text-neutral-500 mt-3">
            Secure payment via Stripe · 30-day money-back guarantee
          </p>
        </form>
      </div>
    </div>
  );
}
