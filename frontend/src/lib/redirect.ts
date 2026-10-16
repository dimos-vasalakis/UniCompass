/**
 * Returns `next` only if it's a same-site relative path, so login links can't
 * be used to bounce users to another site (open redirect).
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}
