"use client";

import { useRouter } from "next/navigation";
import { DeleteSavedMatch } from "@/components/DeleteSavedMatch";
import { Results } from "@/components/MatchResults";
import { useDict, useLocale } from "@/lib/i18n/client";
import { fmt, fmtDate } from "@/lib/i18n/config";
import { storePendingMatch } from "@/lib/pendingMatch";
import type { Campus, Hub, SavedMatch } from "@/types";

/** A saved search, shown as it was when saved (in the language it was saved in). */
export function SavedMatchView({
  saved,
  uniSlug,
  campus,
  hub,
}: {
  saved: SavedMatch;
  uniSlug: string | null;
  campus: Campus | null;
  hub: Hub | null;
}) {
  const d = useDict();
  const locale = useLocale();
  const router = useRouter();

  function adjust() {
    if (!uniSlug) return;
    storePendingMatch({ uniSlug, request: saved.preferences });
    router.push("/match");
  }

  return (
    <Results
      d={d}
      locale={locale}
      results={saved.results}
      campusPoint={campus}
      hub={hub}
      title={d.dashboard.savedTitle}
      subtitle={fmt(d.dashboard.savedFor, {
        dept: saved.department,
        uni: saved.university,
        date: fmtDate(locale, saved.created_at),
      })}
      actions={
        <>
          {uniSlug && (
            <button
              type="button"
              onClick={adjust}
              className="rounded-lg border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-light"
            >
              {d.dashboard.adjust}
            </button>
          )}
          <DeleteSavedMatch
            id={saved.id}
            redirectTo="/dashboard"
            className="rounded-lg border border-border px-4 py-2 font-medium text-danger hover:border-danger"
          />
        </>
      }
    />
  );
}
