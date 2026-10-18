import { expect, test } from "./fixtures";

test("language toggle switches to Greek, persists, and switches back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Got into a university in Athens");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: /Language: Ελληνικά/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Πέρασες σε πανεπιστήμιο στην Αθήνα");
  await expect(page.locator("html")).toHaveAttribute("lang", "el");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Αθήνα");

  await page.getByRole("button", { name: /Γλώσσα: English/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Got into a university in Athens");
});

test("area page content comes back in Greek", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "el", url: "http://localhost:3000" }]);
  await page.goto("/neighborhoods/zografou");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ζωγράφου");
  await expect(page.getByText("Η κλασική φοιτητική περιοχή")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Πλεονεκτήματα και μειονεκτήματα" })).toBeVisible();
  await expect(page.getByText("Πολυτεχνειούπολη Ζωγράφου")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Φοιτητικές λέσχες" })).toBeVisible();
});

test("area index lists every area in Greek", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "el", url: "http://localhost:3000" }]);
  await page.goto("/neighborhoods");
  await expect(page.getByRole("heading", { name: "Κέντρο Αθήνας" })).toBeVisible();
  await expect(page.locator('main a[href^="/neighborhoods/"]')).toHaveCount(49);
});

test("match flow runs in Greek, and switching language translates the results", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "el", url: "http://localhost:3000" }]);
  await page.goto("/match");
  await expect(page.getByRole("heading", { name: "Πού θα σπουδάσεις;" })).toBeVisible();
  await page.getByRole("button", { name: /NTUA/ }).click();
  await page.getByRole("combobox").selectOption({ label: "Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών" });
  await page.getByRole("button", { name: /Επόμενο: οι προτεραιότητές σου/ }).click();
  await expect(page.getByRole("heading", { name: "Τι σε νοιάζει;" })).toBeVisible();
  await page.getByRole("button", { name: "Βρες τις 3 καλύτερες περιοχές" }).click();

  const cards = page.locator("li").filter({ has: page.getByText(/% ταίριασμα/) });
  await expect(cards).toHaveCount(3);
  await expect(cards.first().getByRole("heading")).toContainText("Ζωγράφου");

  // Same results, now in English, without redoing the search.
  await page.getByRole("button", { name: /Γλώσσα: English/ }).click();
  await expect(page.getByText(/% match/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your best areas" })).toBeVisible();
  await expect(page.locator("li").filter({ has: page.getByText(/% match/) })).toHaveCount(3);
});

test("Greek header still fits on one line", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "el", url: "http://localhost:3000" }]);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Σύνδεση" })).toBeVisible();
  const box = await page.getByRole("navigation").boundingBox();
  expect(box!.height).toBeLessThan(70);
});
