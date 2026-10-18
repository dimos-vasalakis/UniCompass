"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { useDict, useLocale } from "@/lib/i18n/client";

// Shows the language you'd switch *to*, in that language's own name.
const OTHER: Record<Locale, { locale: Locale; code: string; name: string }> = {
  en: { locale: "el", code: "ΕΛ", name: "Ελληνικά" },
  el: { locale: "en", code: "EN", name: "English" },
};

export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();
  const d = useDict();
  const other = OTHER[locale];

  function switchLanguage() {
    document.cookie = `${LOCALE_COOKIE}=${other.locale}; path=/; max-age=31536000; samesite=lax`;
    // Re-render server components with the new cookie.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      aria-label={`${d.header.languageAria}: ${other.name}`}
      title={other.name}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs font-semibold hover:bg-brand-light"
    >
      {other.code}
    </button>
  );
}
