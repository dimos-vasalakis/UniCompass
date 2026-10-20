import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in pages and the auth round trip have nothing to index.
      disallow: ["/dashboard", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
