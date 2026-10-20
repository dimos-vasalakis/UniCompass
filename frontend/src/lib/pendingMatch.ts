import type { MatchRequest } from "@/types";

const PENDING_KEY = "unicompass:pending-match";

export type PendingMatch = { uniSlug: string; request: MatchRequest };

/** Hands a search to /match, which restores and re-runs it on load (after a login, or from a saved search). */
export function storePendingMatch(pending: PendingMatch): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {}
}

/** Reads and clears the search left by storePendingMatch, if any. */
export function takePendingMatch(): PendingMatch | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as PendingMatch;
  } catch {
    return null;
  }
}
