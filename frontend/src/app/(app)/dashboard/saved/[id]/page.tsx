import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { SavedMatchView } from "@/components/SavedMatchView";
import { LoadingBlock } from "@/components/Spinner";
import { getPrivate, tryGetPublic } from "@/lib/api/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getAccessToken } from "@/lib/supabase/server";
import type { Hub, SavedMatch, University } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dashboard.savedTitle };
}

async function Saved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) redirect(`/login?next=/dashboard/saved/${id}`);
  const locale = await getLocale();

  let saved: SavedMatch | null;
  try {
    saved = await getPrivate<SavedMatch>(`/match/saved/${encodeURIComponent(id)}?lang=${locale}`, token);
  } catch {
    return <ApiUnavailable />;
  }
  if (!saved) notFound();

  // Campus and hub pins for the map come from the reference data.
  const [universities, hubs] = await Promise.all([
    tryGetPublic<University[]>(`/universities?lang=${locale}`),
    tryGetPublic<Hub[]>(`/hubs?lang=${locale}`),
  ]);
  const uni = universities?.find((u) => u.departments.some((dep) => dep.id === saved.department_id)) ?? null;
  const campusSlug = uni?.departments.find((dep) => dep.id === saved.department_id)?.campus_slug;
  const campus = uni?.campuses.find((c) => c.slug === campusSlug) ?? null;
  const hub = hubs?.find((h) => h.slug === saved.preferences.home_hub_slug) ?? null;

  return <SavedMatchView saved={saved} uniSlug={uni?.slug ?? null} campus={campus} hub={hub} />;
}

export default async function SavedMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const d = (await getDictionary()).dashboard;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
        {d.back}
      </Link>
      <Suspense fallback={<LoadingBlock className="min-h-96" />}>
        <Saved params={params} />
      </Suspense>
    </main>
  );
}
