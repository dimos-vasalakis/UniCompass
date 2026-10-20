"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useDict } from "@/lib/i18n/client";
import { safeNext } from "@/lib/redirect";

export function UsernameForm() {
  const d = useDict().auth.username;
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next")) ?? "/dashboard";
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ username }) });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? d.taken : d.failed);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{d.title}</h1>
        <p className="mt-1 text-sm text-muted">{d.subtitle}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          required
          autoFocus
          autoComplete="username"
          pattern="[A-Za-z0-9_.\-]{3,20}"
          minLength={3}
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={d.placeholder}
          aria-label={d.placeholder}
          className="w-full rounded-lg border border-border px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <p className="text-xs text-muted">{d.hint}</p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-3 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? d.saving : d.submit}
        </button>
      </form>
    </main>
  );
}
