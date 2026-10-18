"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./en";

type Value = {
  locale: Locale;
  dict: Dictionary;
  /** Switch client-side text right away, before the server has re-rendered. */
  showLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<Value | null>(null);

export function LocaleProvider({
  locale: serverLocale,
  dicts,
  children,
}: {
  locale: Locale;
  dicts: Record<Locale, Dictionary>;
  children: React.ReactNode;
}) {
  // The server is the source of truth, but it takes a round trip to re-render: until
  // it catches up, show the language that was just picked. Remembering which server
  // language the pick was made against retires it once the server has changed.
  const [picked, setPicked] = useState<{ base: Locale; to: Locale } | null>(null);
  const locale = picked && picked.base === serverLocale ? picked.to : serverLocale;

  // <html lang> is rendered before the cookie is known; keep it in step.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider
      value={{ locale, dict: dicts[locale], showLocale: (to) => setPicked({ base: serverLocale, to }) }}
    >
      {children}
    </LocaleContext.Provider>
  );
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

export function useShowLocale(): (locale: Locale) => void {
  return useLocaleContext().showLocale;
}
