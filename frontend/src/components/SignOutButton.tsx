"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDict } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const d = useDict();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

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
        {d.common.signOut}
      </button>
      {confirming && (
        <ConfirmDialog
          title={d.signOutDialog.title}
          body={d.signOutDialog.body}
          cancelLabel={d.signOutDialog.cancel}
          confirmLabel={d.signOutDialog.confirm}
          busyLabel={d.signOutDialog.busy}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={signOut}
        />
      )}
    </>
  );
}
