export const LOCALES = ["en", "el"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Replaces {name} placeholders: fmt("Hi {name}", { name: "Ana" }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** "20 Oct 2026, 21:30" / "20 Οκτ 2026, 21:30", in Athens time wherever it renders. */
export function fmtDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Athens",
  }).format(new Date(iso));
}

/** English-first name pair for a neighborhood: Greek readers get the Greek name first. */
export function areaNames(locale: Locale, a: { name: string; name_el: string }): [string, string] {
  return locale === "el" ? [a.name_el, a.name] : [a.name, a.name_el];
}
