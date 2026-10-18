"use client";

import { createContext, useContext, useEffect } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./en";

const LocaleContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  // <html lang> is rendered before the cookie is known; keep it in step.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={{ locale, dict }}>{children}</LocaleContext.Provider>;
}

function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale/useDict must be used inside <LocaleProvider>");
  return ctx;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useDict(): Dictionary {
  return useLocaleContext().dict;
}
