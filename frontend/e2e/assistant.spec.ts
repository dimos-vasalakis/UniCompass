import { expect, test } from "./fixtures";

test("listing check sends visitors without an account to sign-up", async ({ page }) => {
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Is this listing worth it?");
  await expect(page.getByText("Create a free account to get 3 listing checks.")).toBeVisible();
  // No form for visitors: nothing can reach the paid API without an account.
  await expect(page.getByRole("button", { name: "Check this listing" })).toHaveCount(0);

  await page.getByRole("link", { name: "Create a free account" }).click();
  await expect(page).toHaveURL(/\/signup\?next=%2Fassistant/);
});

test("home page links to the listing check", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Found a flat? Check the listing →" }).click();
  await expect(page).toHaveURL(/\/assistant$/);
});
