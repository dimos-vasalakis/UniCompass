import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it.each(["/dashboard", "/match", "/neighborhoods/pagrati?x=1"])("allows same-site path %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    ["absolute URL", "https://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["relative path", "dashboard"],
    ["javascript:", "javascript:alert(1)"],
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_, p) => {
    expect(safeNext(p)).toBeNull();
  });
});
