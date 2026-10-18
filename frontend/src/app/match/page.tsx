import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApiUnavailable, NoAreaData } from "@/components/ApiUnavailable";
import { tryGetPublic } from "@/lib/api/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { Hub, University } from "@/types";
import MatchFlow from "./MatchFlow";

export async function generateMetadata(): Promise<Metadata> {
  const d = (await getDictionary()).meta;
  return { title: d.matchTitle, description: d.matchDescription };
}

async function MatchLoader() {
  await connection();
  const locale = await getLocale();
  const [universities, hubs] = await Promise.all([
    tryGetPublic<University[]>(`/universities?lang=${locale}`),
    tryGetPublic<Hub[]>(`/hubs?lang=${locale}`),
  ]);
  if (!universities || !hubs || !universities.length) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {!universities || !hubs ? <ApiUnavailable /> : <NoAreaData />}
      </div>
    );
  }
  return <MatchFlow universities={universities} hubs={hubs} />;
}

export default function MatchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
          <div className="h-2 w-full rounded bg-brand-light" />
          <div className="h-9 w-72 animate-pulse rounded bg-brand-light" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-brand-light" />
            ))}
          </div>
        </div>
      }
    >
      <MatchLoader />
    </Suspense>
  );
}
