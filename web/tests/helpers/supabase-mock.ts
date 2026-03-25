import { vi } from "vitest";

/**
 * Creates a chainable Supabase query mock that handles both:
 *  - Terminal single()  → resolved via mockResolvedValue
 *  - Terminal await on a builder (insert/update/delete) → resolved via .then
 */
export function makeChain(result: unknown = { data: null, error: null }) {
  const self: Record<string, unknown> = {};
  const chainMethod = () => vi.fn().mockReturnValue(self);

  self.select = chainMethod();
  self.insert = chainMethod();
  self.update = chainMethod();
  self.delete = chainMethod();
  self.upsert = chainMethod();
  self.eq = chainMethod();
  self.neq = chainMethod();
  self.is = chainMethod();
  self.gt = chainMethod();
  self.gte = chainMethod();
  self.lte = chainMethod();
  self.in = chainMethod();
  self.order = chainMethod();
  self.limit = chainMethod();
  // single / maybeSingle terminate the chain with a real Promise
  self.single = vi.fn().mockResolvedValue(result);
  self.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make the chain itself awaitable (for insert / update / delete)
  (self as Record<string, unknown>).then = (
    resolve: (v: unknown) => void,
    reject: (r: unknown) => void
  ) => Promise.resolve(result).then(resolve, reject);

  return self;
}

/** Minimal Supabase server client stub */
export function makeSupabaseClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockReturnValue(makeChain()),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      ...((overrides.auth as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  };
}

/** Minimal Supabase admin client stub */
export function makeAdminClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockReturnValue(makeChain()),
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
      ...((overrides.auth as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  };
}

/** Create a JSON POST NextRequest */
export function makeRequest(
  url: string,
  body: unknown,
  method = "POST"
): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
