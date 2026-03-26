"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  isSubscribed: boolean;
  stripeReady: boolean;
}

export function PricingCheckout({ user, isSubscribed, stripeReady }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setError(null);

    if (!user) {
      router.push("/login?next=/pricing");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      if (json.url) {
        window.location.href = json.url;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (isSubscribed) {
    return (
      <button
        type="button"
        disabled
        className="block w-full text-center px-8 py-3.5 rounded-full font-bold text-[#1a1c1b] bg-[#d97757]/50 cursor-not-allowed"
      >
        Current Plan
      </button>
    );
  }

  if (!stripeReady) {
    return (
      <div className="block w-full text-center px-8 py-3.5 rounded-full font-bold text-white/50 bg-white/10 cursor-not-allowed select-none">
        Coming Soon
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="block w-full text-center px-8 py-3.5 rounded-full font-bold text-[#1a1c1b] transition-all"
        style={{
          background: loading
            ? "rgba(217,119,87,0.5)"
            : "linear-gradient(135deg, #d97757, #f0a882)",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Redirecting to checkout…" : user ? "Subscribe to Pro" : "Get Started"}
      </button>
    </div>
  );
}
