import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function pickDepartment(page: Page, uni: RegExp, dept: string) {
  await page.goto("/match");
  await page.getByRole("button", { name: uni }).click();
  await page.getByRole("combobox").selectOption({ label: dept });
  await page.getByRole("button", { name: /Next: your priorities/ }).click();
  await expect(page.getByRole("heading", { name: "What matters to you?" })).toBeVisible();
}

async function setSlider(page: Page, label: string, value: number) {
  await page.getByLabel(new RegExp(`^${label}`)).fill(String(value));
}

async function findAreas(page: Page) {
  await page.getByRole("button", { name: /Find my 3 best areas/ }).click();
  await expect(page.getByRole("heading", { name: "Your best areas" })).toBeVisible();
}

const cards = (page: Page) => page.locator("li").filter({ has: page.getByText(/% match/) });

test("NTUA student who cares about commute and rent gets eastern areas", async ({ page }) => {
  await pickDepartment(page, /NTUA/, "Electrical and Computer Engineering");
  await setSlider(page, "Quick trip to campus", 5);
  await setSlider(page, "Low rent", 5);
  await findAreas(page);

  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first().getByRole("heading")).toContainText("Zografou");
  await expect(cards(page).first().getByText(/✓|Shorter commute/).first()).toBeVisible();

  // Map: 3 numbered pins + campus pin (nearby supermarket/gym/canteen pins come on top), with tiles loaded.
  await expect(page.locator(".leaflet-marker-icon").filter({ hasText: /^[123🎓]$/u })).toHaveCount(4);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
});

test("getting home via the port favours Piraeus-side areas", async ({ page }) => {
  await pickDepartment(page, /UniPi/, "Maritime Studies");
  await page.getByLabel("How you travel home").selectOption("piraeus-port");
  await setSlider(page, "Being close to", 5);
  await findAreas(page);

  const names = await cards(page).getByRole("heading").allInnerTexts();
  expect(names.join(" ")).toMatch(/Piraeus|Neo Faliro|Nikaia|Keratsini|Moschato/);
  await expect(cards(page).first().getByText(/To Port of Piraeus/)).toBeVisible();
});

test("tight limits show the empty state, and adjusting brings results back", async ({ page }) => {
  await pickDepartment(page, /NTUA/, "Civil Engineering");
  await page.getByLabel("Maximum rent (studio)").selectOption({ label: "up to €400/month" });
  await page.getByLabel("Maximum commute").selectOption({ label: "up to 20 min" });
  await findAreas(page);
  await expect(page.getByText("No area fits all your limits.")).toBeVisible();

  await page.getByRole("button", { name: "Adjust priorities" }).click();
  await page.getByLabel("Maximum rent (studio)").selectOption({ label: "No limit" });
  await page.getByLabel("Maximum commute").selectOption({ label: "No limit" });
  await findAreas(page);
  await expect(cards(page)).toHaveCount(3);
});

test("saving while logged out asks you to sign in", async ({ page }) => {
  await pickDepartment(page, /AUEB/, "Informatics");
  await findAreas(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)match/);
});

test("stepper lets you go back but not skip ahead", async ({ page }) => {
  await pickDepartment(page, /Panteion/, "Psychology");
  await expect(page.getByRole("button", { name: /Your best areas/ })).toBeDisabled();
  await page.getByRole("button", { name: /Where you study/ }).click();
  await expect(page.getByRole("heading", { name: "Where will you study?" })).toBeVisible();
});
