"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    // Leave any protected page, then re-render server components without the session.
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className="hover:text-brand disabled:opacity-60">
      Sign out
    </button>
  );
}
