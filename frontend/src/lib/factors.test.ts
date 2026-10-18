import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FACTOR_KEYS, SCORE_KEYS, ZONE_KEYS } from "./factors";
import { el } from "./i18n/el";
import { en } from "./i18n/en";

const BACKEND = path.resolve(__dirname, "../../../backend");

/** The `Factor = Literal[...]` list from the backend's match schema. */
function backendFactors(): string[] {
  const src = readFileSync(path.join(BACKEND, "app/schemas/match.py"), "utf8");
  const literal = src.match(/Factor = Literal\[([\s\S]*?)\]/)?.[1] ?? "";
  return [...literal.matchAll(/"(\w+)"/g)].map((m) => m[1]);
}

const athens = JSON.parse(readFileSync(path.join(BACKEND, "data/athens.json"), "utf8"));

const DICTIONARIES = { en, el };

describe("factors stay in sync with the backend", () => {
  it("has a slider for every backend factor, once", () => {
    expect(new Set(FACTOR_KEYS).size).toBe(FACTOR_KEYS.length);
    expect([...FACTOR_KEYS].sort()).toEqual(backendFactors().sort());
  });

  it.each(Object.entries(DICTIONARIES))("%s labels every factor", (_, d) => {
    for (const key of backendFactors()) {
      const f = d.factors[key as keyof typeof d.factors];
      expect(f.label && f.driver && f.hint, key).toBeTruthy();
    }
  });

  it("shows exactly the scores the data has", () => {
    for (const n of athens.neighborhoods) {
      expect(Object.keys(n.scores).sort()).toEqual([...SCORE_KEYS].sort());
    }
  });

  it.each(Object.entries(DICTIONARIES))("%s knows every score, zone and hub kind in the data", (_, d) => {
    for (const k of SCORE_KEYS) expect(d.scores[k], k).toBeTruthy();
    for (const n of athens.neighborhoods) {
      expect(ZONE_KEYS as readonly string[], n.slug).toContain(n.zone);
      expect(d.zones[n.zone as keyof typeof d.zones], n.slug).toBeTruthy();
    }
    for (const h of athens.transit_hubs) {
      expect(d.hubKinds[h.kind as keyof typeof d.hubKinds], h.slug).toBeTruthy();
    }
  });
});
