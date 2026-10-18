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

/** English-first name pair for a neighborhood: Greek readers get the Greek name first. */
export function areaNames(locale: Locale, a: { name: string; name_el: string }): [string, string] {
  return locale === "el" ? [a.name_el, a.name] : [a.name, a.name_el];
}
