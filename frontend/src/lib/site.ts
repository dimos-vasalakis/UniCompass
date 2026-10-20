/**
 * Public origin for absolute URLs (robots.txt, sitemap). Set NEXT_PUBLIC_SITE_URL once there is a
 * custom domain; until then Vercel's production URL, and localhost in development.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
