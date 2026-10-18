import { describe, expect, it } from "vitest";
import { areaNames, fmt, isLocale } from "./config";
import { el } from "./el";
import { en } from "./en";

/** Every string in a dictionary, with its path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  return Object.entries(value as object).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const greek = /[Ͱ-Ͽἀ-῿]/;

describe("dictionaries", () => {
  const enStrings = new Map(strings(en));
  const elStrings = new Map(strings(el));

  it("el has exactly the keys of en", () => {
    expect([...elStrings.keys()]).toEqual([...enStrings.keys()]);
  });

  it("uses the same {placeholders} in both languages", () => {
    for (const [path, text] of enStrings) {
      expect(placeholders(elStrings.get(path) ?? ""), path).toEqual(placeholders(text));
    }
  });

  it("has no empty strings, and no Latin letter glued to a Greek one", () => {
    for (const [path, text] of elStrings) {
      expect(text.trim(), path).not.toBe("");
      expect(text, path).not.toMatch(/[A-Za-z][Ͱ-Ͽ]|[Ͱ-Ͽ][A-Za-z]/);
    }
  });

  it("translates the text (apart from names and symbols)", () => {
    const untranslated = [...elStrings].filter(([path, text]) => !greek.test(text) && text === enStrings.get(path));
    // Brand names, placeholders-only strings and symbols are allowed to match.
    expect(untranslated.map(([p]) => p).sort()).toEqual(["match.legendHub", "pricing.title"]);
  });
});

describe("helpers", () => {
  it("fmt fills placeholders and leaves unknown ones alone", () => {
    expect(fmt("{n} min, {x}", { n: 5 })).toBe("5 min, {x}");
  });

  it("isLocale only accepts supported languages", () => {
    expect(isLocale("el")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("areaNames puts the reader's language first", () => {
    const a = { name: "Pagrati", name_el: "Παγκράτι" };
    expect(areaNames("en", a)).toEqual(["Pagrati", "Παγκράτι"]);
    expect(areaNames("el", a)).toEqual(["Παγκράτι", "Pagrati"]);
  });
});
