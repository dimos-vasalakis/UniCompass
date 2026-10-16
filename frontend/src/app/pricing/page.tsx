"use client";

import { apiFetch } from "@/lib/api/client";

export default function PricingPage() {
  async function upgrade() {
    const { url } = await apiFetch<{ url: string }>("/billing/checkout", {
      method: "POST",
    });
    window.location.href = url;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">UniCompass Premium</h1>
      <button
        onClick={upgrade}
        className="mt-4 rounded bg-accent px-4 py-2 font-semibold text-foreground hover:bg-accent-dark"
      >
        Upgrade
      </button>
    </main>
  );
}
