export const INDEX_FRESHNESS_MS = 2 * 60 * 60 * 1000;

export interface IndexStatus {
  status: "recent" | "stale" | "empty" | "unavailable";
  embeddingCount: number | null;
  lastUpdatedAt: string | null;
}

export function describeIndex(count: number | null, updatedAt: string | null, failed = false, now = Date.now()): IndexStatus {
  if (failed || count === null || !Number.isSafeInteger(count) || count < 0) {
    return { status: "unavailable", embeddingCount: null, lastUpdatedAt: null };
  }
  if (count === 0) return { status: "empty", embeddingCount: 0, lastUpdatedAt: null };
  const updated = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(updated)) return { status: "unavailable", embeddingCount: null, lastUpdatedAt: null };
  return { status: now - updated < INDEX_FRESHNESS_MS ? "recent" : "stale", embeddingCount: count, lastUpdatedAt: new Date(updated).toISOString() };
}
