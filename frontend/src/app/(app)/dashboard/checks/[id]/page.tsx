import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { ListingCheckResult } from "@/components/ListingCheckResult";
import { LoadingBlock } from "@/components/Spinner";
import { PrivateApiError, getPrivate } from "@/lib/api/server";
import { fmt, fmtDate } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getAccessToken } from "@/lib/supabase/server";
import type { ListingCheck } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).assistant.resultTitle };
}

async function Check({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Check ids are UUIDs; anything else would be a 422 from the API, not a 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const token = await getAccessToken();
  if (!token) redirect(`/login?next=/dashboard/checks/${id}`);
  const d = (await getDictionary()).assistant;
  const locale = await getLocale();

  let check: ListingCheck | null;
  try {
    check = await getPrivate<ListingCheck>(`/assistant/listing-checks/${encodeURIComponent(id)}`, token);
  } catch (e) {
    // The backend rejected the session (expired or revoked): sign in again.
    if (e instanceof PrivateApiError && e.status === 401) redirect(`/login?next=/dashboard/checks/${id}`);
    return <ApiUnavailable />;
  }
  if (!check) notFound();

  // The answer stays in the language it was checked in (labels follow the UI).
  return (
    <>
      <p className="mb-4 text-sm text-muted">{fmt(d.checkedOn, { date: fmtDate(locale, check.created_at) })}</p>
      <ListingCheckResult result={check.result} lang={check.lang} />
    </>
  );
}

export default async function ListingCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const d = (await getDictionary()).assistant;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/assistant" className="text-sm font-medium text-brand hover:underline">
        {d.back}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{d.resultTitle}</h1>
      <div className="mt-4">
        <Suspense fallback={<LoadingBlock className="min-h-64" />}>
          <Check params={params} />
        </Suspense>
      </div>
    </main>
  );
}
