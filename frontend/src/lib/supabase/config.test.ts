import { describe, expect, it } from "vitest";
import { isSupabaseConfigured } from "./config";

describe("isSupabaseConfigured", () => {
  it("accepts a real project URL and key", () => {
    expect(isSupabaseConfigured("https://abcdefgh.supabase.co", "eyJhbGciOi...")).toBe(true);
  });

  it.each([
    ["the .env.example placeholder", "https://your-project.supabase.co", "key"],
    ["an empty key", "https://abcdefgh.supabase.co", ""],
    ["a blank key", "https://abcdefgh.supabase.co", "   "],
    ["an empty URL", "", "key"],
    ["a URL without scheme", "abcdefgh.supabase.co", "key"],
  ])("rejects %s", (_, url, key) => {
    expect(isSupabaseConfigured(url, key)).toBe(false);
  });
});
