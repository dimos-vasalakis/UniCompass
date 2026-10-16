import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FACTORS, FACTOR_BY_KEY, HUB_KIND_LABELS, SCORE_LABELS, ZONES } from "./factors";

const BACKEND = path.resolve(__dirname, "../../../backend");

/** The `Factor = Literal[...]` list from the backend's match schema. */
function backendFactors(): string[] {
  const src = readFileSync(path.join(BACKEND, "app/schemas/match.py"), "utf8");
  const literal = src.match(/Factor = Literal\[([\s\S]*?)\]/)?.[1] ?? "";
  return [...literal.matchAll(/"(\w+)"/g)].map((m) => m[1]);
}

const athens = JSON.parse(readFileSync(path.join(BACKEND, "data/athens.json"), "utf8"));

describe("factors stay in sync with the backend", () => {
  it("has a slider for every backend factor, once", () => {
    const keys = FACTORS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(backendFactors().sort());
  });

  it("labels every factor", () => {
    for (const key of backendFactors()) {
      const f = FACTOR_BY_KEY[key as keyof typeof FACTOR_BY_KEY];
      expect(f.label && f.driver && f.hint, key).toBeTruthy();
    }
  });

  it("labels every score shown on area pages", () => {
    for (const n of athens.neighborhoods) {
      expect(Object.keys(n.scores).sort()).toEqual(Object.keys(SCORE_LABELS).sort());
    }
  });

  it("knows every zone and hub kind in the data", () => {
    for (const n of athens.neighborhoods) expect(ZONES[n.zone], n.slug).toBeDefined();
    for (const h of athens.transit_hubs) expect(HUB_KIND_LABELS[h.kind], h.slug).toBeDefined();
  });
});
