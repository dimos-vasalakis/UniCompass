import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/Spinner";
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
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <LoadingBlock className="min-h-96" />
        </div>
      }
    >
      <MatchLoader />
    </Suspense>
  );
}
