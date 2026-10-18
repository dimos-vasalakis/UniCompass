import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { el } from "./el";
import { en, type Dictionary } from "./en";

export const DICTIONARIES: Record<Locale, Dictionary> = { en, el };

/** The visitor's language from the `locale` cookie; English until they choose. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getDictionary(): Promise<Dictionary> {
  return DICTIONARIES[await getLocale()];
}
