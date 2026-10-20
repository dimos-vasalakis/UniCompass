"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/lib/i18n/client";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Spinner";

type Mode = "signin" | "signup";

const SWITCH_HREF = { signin: "/signup", signup: "/login" } as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function AuthForm({ mode, configured }: { mode: Mode; configured: boolean }) {
  const d = useDict();
  const copy = d.auth[mode];
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth" ? d.auth.invalidLink : null,
  );

  function callbackUrl() {
    // Always carries a query string: the email templates append `&token_hash=…` to it.
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next ?? "/dashboard");
    return url.toString();
  }

  async function withProvider(provider: "google" | "github") {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
        // Sign-in only works for existing accounts; sign-up creates one.
        shouldCreateUser: mode === "signup",
        data: mode === "signup" && fullName ? { full_name: fullName } : undefined,
      },
    });
    setBusy(false);
    // Treat "no account for this email" like a sent link so sign-in doesn't
    // reveal which emails are registered; the sent screen links to sign-up.
    const noAccount =
      mode === "signin" && !!error && (error.code === "otp_disabled" || /signups not allowed/i.test(error.message));
    if (!error || noAccount) setSent(true);
    else setError(error.message);
  }

  // Keep `next` and whatever email was typed when switching sign in ⇄ sign up.
  const switchParams = new URLSearchParams();
  if (next) switchParams.set("next", next);
  if (email) switchParams.set("email", email);
  const switchQuery = switchParams.toString();
  const switchHref = switchQuery ? `${SWITCH_HREF[mode]}?${switchQuery}` : SWITCH_HREF[mode];
  const input =
    "w-full rounded-lg border border-border px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <Image src="/logo.png" alt="UniCompass" width={150} height={114} className="mx-auto" />
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
      </div>

      {!configured && (
        <p className="rounded-lg border border-accent bg-accent/15 p-3 text-sm">
          {d.auth.notConfigured.split("{file}")[0]}
          <code>frontend/.env.local</code>
          {d.auth.notConfigured.split("{file}")[1]}
          <Link href="/match" className="font-medium text-brand underline">
            {d.auth.notConfiguredLink}
          </Link>
          {d.auth.notConfiguredAfter}
        </p>
      )}

      {sent ? (
        <div className="rounded-lg bg-brand-light p-4 text-center">
          <p className="font-medium">{d.auth.checkEmail}</p>
          {mode === "signup" ? (
            <p className="mt-1 text-sm text-muted">
              {d.auth.sentSignupBefore}
              <strong>{email}</strong>
              {d.auth.sentSignupAfter}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {d.auth.sentSigninBefore}
              <strong>{email}</strong>
              {d.auth.sentSigninAfter}
              <Link href={switchHref} className="font-medium text-brand underline">
                {d.auth.createAccount}
              </Link>
            </p>
          )}
        </div>
      ) : (
        <fieldset disabled={!configured} className="flex flex-col gap-3 disabled:opacity-50">
          <button
            type="button"
            onClick={() => withProvider("google")}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 font-medium hover:bg-brand-light"
          >
            <GoogleIcon />
            {copy.oauth} Google
          </button>
          <button
            type="button"
            onClick={() => withProvider("github")}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#24292f] px-3 py-2.5 font-medium text-white hover:bg-[#32383f]"
          >
            <GitHubIcon />
            {copy.oauth} GitHub
          </button>

          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-border" />
            {d.auth.orWithEmail}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={withEmail} className="flex flex-col gap-3">
            {mode === "signup" && (
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={d.auth.namePlaceholder}
                className={input}
              />
            )}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={input}
            />
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {busy && <Spinner size={16} className="text-white" decorative />}
              {busy ? d.auth.sending : copy.email}
            </button>
          </form>
        </fieldset>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-center text-sm text-muted">
        {copy.switchText}{" "}
        <Link href={switchHref} className="font-medium text-brand hover:underline">
          {copy.switchLink}
        </Link>
      </p>
    </main>
  );
}
