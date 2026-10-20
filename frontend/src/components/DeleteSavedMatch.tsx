"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api/client";
import { useDict } from "@/lib/i18n/client";

/** Delete button with a confirmation step. Goes to `redirectTo` afterwards, or refreshes the current page. */
export function DeleteSavedMatch({ id, redirectTo, className }: { id: string; redirectTo?: string; className?: string }) {
  const d = useDict().dashboard;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/match/saved/${id}`, { method: "DELETE" });
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(d.deleteError);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={className ?? "rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-danger hover:border-danger"}
      >
        {d.delete}
      </button>
      {confirming && (
        <ConfirmDialog
          title={d.deleteTitle}
          body={d.deleteBody}
          cancelLabel={d.cancel}
          confirmLabel={d.delete}
          busyLabel={d.deleting}
          busy={busy}
          error={error}
          onCancel={() => {
            setConfirming(false);
            setError(null);
          }}
          onConfirm={remove}
        />
      )}
    </>
  );
}
