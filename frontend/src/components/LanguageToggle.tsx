"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { useDict, useLocale, useShowLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

// Shows the language you'd switch *to*, in that language's own name.
const OTHER: Record<Locale, { locale: Locale; code: string; name: string }> = {
  en: { locale: "el", code: "ΕΛ", name: "Ελληνικά" },
  el: { locale: "en", code: "EN", name: "English" },
};

export function LanguageToggle() {
  const locale = useLocale();
  const d = useDict();
  const showLocale = useShowLocale();
  const [pending, startTransition] = useTransition();
  const other = OTHER[locale];

  function switchLanguage() {
    showLocale(other.locale);
    startTransition(async () => {
      await setLocale(other.locale);
    });
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      disabled={pending}
      aria-busy={pending}
      aria-label={`${d.header.languageAria}: ${other.name}`}
      title={other.name}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs font-semibold hover:bg-brand-light disabled:opacity-60"
    >
      {other.code}
    </button>
  );
}
