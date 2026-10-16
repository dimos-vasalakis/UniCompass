import { defineConfig, devices } from "@playwright/test";

// Runs the real backend (against a migrated + seeded Postgres) and frontend.
// Locally: start the test DB (README "Backend tests"), then `npm run test:e2e`.
const CI = !!process.env.CI;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres:test@localhost:55432/postgres";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(CI ? {} : { channel: "chrome" }) } },
    { name: "phone", use: { ...devices["Pixel 7"], ...(CI ? {} : { channel: "chrome" }) } },
  ],
  webServer: [
    {
      command: `${CI ? "uvicorn" : ".venv/bin/uvicorn"} app.main:app --port 8000`,
      cwd: "../backend",
      url: "http://localhost:8000/api/v1/health",
      reuseExistingServer: !CI,
      env: { DATABASE_URL, UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
    },
    {
      // CI builds first (separate step) and serves the production build.
      command: CI ? "npm run start" : "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:8000" },
    },
  ],
});
