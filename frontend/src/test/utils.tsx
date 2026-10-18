import { render as rtlRender } from "@testing-library/react";
import type { ReactElement } from "react";
import { LocaleProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { el } from "@/lib/i18n/el";
import { en } from "@/lib/i18n/en";

/** Like Testing Library's render, inside the language provider the app has (English by default). */
export function render(ui: ReactElement, { locale = "en" }: { locale?: Locale } = {}) {
  return rtlRender(
    <LocaleProvider locale={locale} dict={locale === "el" ? el : en}>
      {ui}
    </LocaleProvider>,
  );
}
