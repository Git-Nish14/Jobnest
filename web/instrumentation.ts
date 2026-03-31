/**
 * Next.js Instrumentation hook — runs once when the server process starts.
 * Use this for startup validation (env vars, DB connectivity checks, etc.)
 * so failures surface immediately rather than on the first live request.
 */
export async function register() {
  // Only validate on the Node.js runtime (not the Edge runtime / client).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}
