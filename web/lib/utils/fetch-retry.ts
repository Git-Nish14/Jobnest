/**
 * Wraps fetch with:
 *  - Automatic retry on network failures (not on 4xx/5xx HTTP errors)
 *  - Per-request AbortController timeout
 *  - Human-readable error messages instead of raw browser TypeErrors
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  {
    retries = 2,
    timeoutMs = 15_000,
    retryDelayMs = 1_000,
  }: { retries?: number; timeoutMs?: number; retryDelayMs?: number } = {}
): Promise<Response> {
  let lastError: Error = new Error("Network request failed. Please try again.");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof Error) {
        lastError =
          err.name === "AbortError"
            ? new Error("Request timed out — please check your connection and try again.")
            : new Error("Connection error — please check your internet and try again.");
      }

      // Only delay between retries, not after the last attempt
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Converts any caught error to a user-friendly string.
 * Specifically handles the raw "Failed to fetch" browser TypeError.
 */
export function getNetworkErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred. Please try again.";

  const msg = err.message.toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("connection error") ||
    msg.includes("load failed") // Safari
  ) {
    return "Connection error — please check your internet and try again.";
  }

  return err.message || "An unexpected error occurred. Please try again.";
}
