"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./config";

// A Server Action, not document.cookie + router.refresh(): setting the cookie here
// re-renders the current page in the same round trip and drops every cached page
// from the client router cache, so no page keeps showing the old language.
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
