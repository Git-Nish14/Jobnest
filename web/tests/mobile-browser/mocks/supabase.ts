declare global {
  interface Window {
    __mobileTestWrites: Array<{ table: string; operation: string; values: unknown }>;
  }
}

window.__mobileTestWrites = [];

/** An in-memory client only: this harness must never contact a real account. */
export function createClient() {
  return {
    from(table: string) {
      let mutation = false;
      const result = () => Promise.resolve({
        data: mutation ? { id: "fixture-application" } : null,
        error: null,
      });
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        ilike: () => query,
        in: () => query,
        limit: () => query,
        order: () => query,
        single: result,
        maybeSingle: result,
        update(values: unknown) {
          mutation = true;
          window.__mobileTestWrites.push({ table, operation: "update", values });
          return query;
        },
        insert(values: unknown) {
          mutation = true;
          window.__mobileTestWrites.push({ table, operation: "insert", values });
          return query;
        },
        delete() {
          mutation = true;
          window.__mobileTestWrites.push({ table, operation: "delete", values: null });
          return query;
        },
        then: <T>(resolve: (value: Awaited<ReturnType<typeof result>>) => T) => result().then(resolve),
      };
      return query;
    },
  };
}
