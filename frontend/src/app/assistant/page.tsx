import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { ListingCheckForm } from "@/components/ListingCheckForm";
import { LoadingBlock } from "@/components/Spinner";
import { PrivateApiError, getPrivate, tryGetPublic } from "@/lib/api/server";
import { fmt, fmtDate } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { FALLBACK_LIMITS } from "@/lib/listingCheck";
import { getAccessToken, getUser } from "@/lib/supabase/server";
import type { ListingCheckLimits, ListingChecks, University } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  const d = (await getDictionary()).meta;
  return { title: d.assistantTitle, description: d.assistantDescription };
}

const NEXT = encodeURIComponent("/assistant");

// Public route on purpose: visitors without an account see what this does and
// are sent to sign-up (not /login, which PROTECTED_PREFIXES would do).
function SignupPrompt({ d, limit }: { d: Awaited<ReturnType<typeof getDictionary>>["assistant"]; limit: number }) {
  return (
    <section className="space-y-4 rounded-lg border border-border p-6">
      <p className="font-medium">{fmt(d.signupPitch, { limit })}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/signup?next=${NEXT}`}
          className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          {d.signupCta}
        </Link>
        <span className="text-sm text-muted">
          {d.haveAccount}{" "}
          <Link href={`/login?next=${NEXT}`} className="font-medium text-brand hover:underline">
            {d.signIn}
          </Link>
        </span>
      </div>
    </section>
  );
}

async function Assistant() {
  const d = (await getDictionary()).assistant;
  const locale = await getLocale();
  await connection();
  const limits = (await tryGetPublic<ListingCheckLimits>("/assistant/limits")) ?? FALLBACK_LIMITS;
  const user = await getUser();
  const token = user ? await getAccessToken() : null;
  if (!token) return <SignupPrompt d={d} limit={limits.checks_per_account} />;

  const [checksRes, universities] = await Promise.all([
    getPrivate<ListingChecks>("/assistant/listing-checks", token).then(
      (checks) => ({ checks, status: 200 }),
      (e: unknown) => ({ checks: null, status: e instanceof PrivateApiError ? e.status : 0 }),
    ),
    tryGetPublic<University[]>(`/universities?lang=${locale}`).then((u) => u ?? []),
  ]);
  // The backend rejected the session (expired or revoked): offer to sign in again.
  if (checksRes.status === 401) return <SignupPrompt d={d} limit={limits.checks_per_account} />;
  const { checks } = checksRes;
  if (!checks) return <ApiUnavailable />;

  return (
    <>
      <ListingCheckForm universities={universities} limits={{ ...limits, checks_per_account: checks.limit }} remaining={checks.remaining} />
      {checks.checks.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">{d.history}</h2>
          <ul className="mt-3 space-y-2">
            {checks.checks.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/checks/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:border-brand"
                >
                  <span>
                    <span className="font-medium">{d.verdicts[c.result.verdict]}</span>
                    {c.result.details.rent_eur !== null && <span className="text-muted"> · {c.result.details.rent_eur}€</span>}
                    {c.result.area && <span className="text-muted"> · {locale === "el" ? c.result.area.name_el : c.result.area.name}</span>}
                  </span>
                  <span className="text-sm text-muted">{fmt(d.checkedOn, { date: fmtDate(locale, c.created_at) })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default async function AssistantPage() {
  const d = (await getDictionary()).assistant;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold sm:text-3xl">{d.title}</h1>
      <p className="mt-2 mb-6 text-muted">{d.intro}</p>
      <Suspense fallback={<LoadingBlock className="min-h-64" />}>
        <Assistant />
      </Suspense>
    </main>
  );
}
