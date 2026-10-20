import { expect, test } from "./fixtures";

test("home page links to the match flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Athens");
  await page.getByRole("main").getByRole("link", { name: "Find my area" }).click();
  await expect(page).toHaveURL(/\/match$/);
  await expect(page.getByRole("heading", { name: "Where will you study?" })).toBeVisible();
});

test("area index lists every area, grouped by zone", async ({ page }) => {
  await page.goto("/neighborhoods");
  await expect(page.getByRole("heading", { name: "Central Athens" })).toBeVisible();
  await expect(page.locator('main a[href^="/neighborhoods/"]')).toHaveCount(49);
});

test("area page shows pros/cons, scores and travel times", async ({ page }) => {
  await page.goto("/neighborhoods/zografou");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Zografou");
  await expect(page.getByRole("heading", { name: "Advantages and disadvantages" })).toBeVisible();
  await expect(page.getByText("NTUA (ΕΜΠ)").first()).toBeVisible();
  await expect(page.getByText(/KTEL Kifisou/)).toBeVisible();
});

test("unknown area shows not found", async ({ page }) => {
  await page.goto("/neighborhoods/atlantis");
  await expect(page.getByText(/could not be found/i)).toBeVisible();
});

test("dashboard sends logged-out users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("sign in and sign up link to each other", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your free account" })).toBeVisible();
  await expect(page.getByPlaceholder("Your name")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("header fits on one line", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");
  const box = await nav.boundingBox();
  expect(box!.height).toBeLessThan(70);
});

test("switching to sign up keeps the email you typed", async ({ page }) => {
  // Next 16 keeps the previous page mounted (hidden) for back navigation, so
  // only look at the visible email field.
  const email = page.locator('input[type="email"]:visible');
  await page.goto("/login?email=maria%40example.gr&next=%2Fmatch");
  await expect(email).toHaveValue("maria@example.gr");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your free account" })).toBeVisible();
  await expect(page).toHaveURL(/next=%2Fmatch/);
  await expect(email).toHaveValue("maria@example.gr");
});

test("area page shows the metro station and reveals its lines on click", async ({ page }) => {
  await page.goto("/neighborhoods/pagrati");
  await expect(page.getByRole("heading", { name: "Metro", exact: true })).toBeVisible();
  const station = page.locator("button[aria-controls]").filter({ hasText: /station/i });
  await expect(station).toBeVisible();
  await station.click();
  await expect(page.getByRole("list", { name: /^Lines at / })).toBeVisible();
  await expect(page.getByText(/line$/).first()).toBeVisible();
});

test("area page has a map with the area and its metro station", async ({ page }) => {
  await page.goto("/neighborhoods/zografou");
  await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon").filter({ hasText: /^⌂$/ })).toHaveCount(1);
  const station = page.locator(".leaflet-marker-icon").filter({ hasText: /^Μ$/ });
  await expect(station).toHaveCount(1);
  await station.dispatchEvent("click");
  await expect(page.locator(".leaflet-overlay-pane path").first()).toBeVisible();
});

test("the theme starts light, survives a reload, and resets in a fresh browser session", async ({ page, browser }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // A new context has no session storage, like closing and reopening the browser.
  const fresh = await browser.newContext({ colorScheme: "dark" });
  const other = await fresh.newPage();
  await other.goto("http://localhost:3000/");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await fresh.close();
});
