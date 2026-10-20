import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("keeps crawlers out of signed-in pages and points to the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(["/dashboard", "/auth/"]));
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
