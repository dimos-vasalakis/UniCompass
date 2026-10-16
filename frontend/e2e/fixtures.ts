import { test as base, expect } from "@playwright/test";

// Fail any test that logs a console error, except ones we expect on purpose.
const EXPECTED = [/status of 401/];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !EXPECTED.some((re) => re.test(m.text()))) errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await use(errors);
      expect(errors, "unexpected console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
