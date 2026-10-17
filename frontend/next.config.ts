import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "dimos-vasalakis",
  project: "unicompass-frontend",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  silent: !process.env.CI,
});
