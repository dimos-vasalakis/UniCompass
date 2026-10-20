import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { tryGetPublic } from "@/lib/api/server";
import { SITE_URL } from "@/lib/site";
import type { NeighborhoodSummary } from "@/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Built per request (then cached by getPublic), so `next build` never needs the API.
  await connection();
  const hoods = (await tryGetPublic<NeighborhoodSummary[]>("/neighborhoods")) ?? [];
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/match`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/neighborhoods`, changeFrequency: "weekly", priority: 0.8 },
    ...hoods.map((n) => ({
      url: `${SITE_URL}/neighborhoods/${n.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
