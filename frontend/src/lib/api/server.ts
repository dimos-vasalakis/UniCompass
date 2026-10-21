import { cacheLife } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Cached GET for public reference data, for Server Components.
 * Call it after `await connection()` (or inside a dynamic segment) so it runs at
 * request time rather than during `next build`, when the API may be unreachable.
 * Returns null on 404.
 */
export async function getPublic<T>(path: string): Promise<T | null> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(`${API_URL}/api/v1${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export class PrivateApiError extends Error {
  constructor(
    public status: number,
    path: string,
  ) {
    super(`API ${status} for ${path}`);
  }
}

/** Uncached authenticated GET for Server Components (e.g. the user's saved data). Returns null on 404. */
export async function getPrivate<T>(path: string, accessToken: string): Promise<T | null> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new PrivateApiError(res.status, path);
  return (await res.json()) as T;
}

/** Like getPublic, but returns undefined instead of throwing when the API is down. */
export async function tryGetPublic<T>(path: string): Promise<T | null | undefined> {
  try {
    return await getPublic<T>(path);
  } catch (e) {
    console.error(`[api] ${path}:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}
