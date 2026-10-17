"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setConfirming(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, busy]);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    // Leave any protected page, then re-render server components without the session.
    router.replace("/");
    router.refresh();
    setConfirming(false);
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className="hover:text-brand">
        Sign out
      </button>
      {confirming && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm whitespace-normal rounded-xl border border-border bg-background p-5 shadow-xl"
          >
            <h2 id="signout-title" className="text-lg font-semibold">
              Sign out?
            </h2>
            <p className="mt-1 text-sm text-muted">Are you sure you want to sign out of UniCompass?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-brand-light disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={busy}
                className="rounded-lg bg-brand px-3 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
