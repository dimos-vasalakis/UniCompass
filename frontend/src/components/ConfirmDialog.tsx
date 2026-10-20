"use client";

import { useEffect, useId, useRef } from "react";
import { Spinner } from "@/components/Spinner";

/** Modal "are you sure?" box. Focuses Cancel, closes on Escape or a backdrop click unless busy. */
export function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4" onClick={() => !busy && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm whitespace-normal rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{body}</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-brand-light disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {busy && <Spinner size={16} className="text-white" decorative />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
