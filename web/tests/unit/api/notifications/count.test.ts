import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }));
import { GET } from '@/app/api/notifications/count/route';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rate-limit';

const results = new Map<string, { count: number | null; error: unknown }>();
const ownershipFilters = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  results.clear();
  results.set('reminders', { count: 2, error: null });
  results.set('interviews', { count: 3, error: null });
  results.set('notifications', { count: 4, error: null });
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
    from(table: string) {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { ownershipFilters(table, column, value); return query; },
        lt: () => query, gte: () => query, lte: () => query,
        then: (resolve: (result: unknown) => void) => Promise.resolve(results.get(table)).then(resolve),
      };
      return query;
    },
  } as never);
});

describe('notification counts used for Realtime reconciliation', () => {
  it('returns fresh, user-scoped totals without HTTP caching', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ overdueReminders: 2, upcomingInterviews: 3, unreadNotifications: 4, total: 9 });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    for (const table of results.keys()) expect(ownershipFilters).toHaveBeenCalledWith(table, 'user_id', 'test-user');
  });

  it.each(['reminders', 'interviews', 'notifications'])('does not falsely clear the badge when %s query fails', async table => {
    results.set(table, { count: null, error: { message: 'Database unavailable' } });
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('total');
  });

  it('rejects an unauthenticated count request', async () => {
    vi.mocked(createClient).mockResolvedValue({ auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    } } as never);
    expect((await GET()).status).toBe(401);
  });

  it('enforces the per-user rate limit', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    expect((await GET()).status).toBe(429);
  });
});
