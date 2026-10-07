declare global {
  interface Window {
    __mobileTestWrites: Array<{ table: string; operation: string; values: unknown }>;
    __mobileRealtime: {
      subscribed: boolean;
      emit: (event: string, row: { is_read: boolean }) => void;
    };
  }
}

window.__mobileTestWrites = [];
type Listener = { event: string; table: string; callback: (payload: { new: { is_read: boolean } }) => void };
const listeners = new Set<Listener>();
window.__mobileRealtime = {
  subscribed: false,
  emit(event, row) {
    for (const listener of listeners) {
      if (listener.table === 'notifications' && listener.event === event) listener.callback({ new: row });
    }
  },
};

/** An in-memory client only: this harness must never contact a real account. */
export function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }) },
    channel() {
      const owned = new Set<Listener>();
      const channel = {
        on(_type: string, filter: { event: string; table: string }, callback: Listener['callback']) {
          const listener = { ...filter, callback };
          owned.add(listener);
          listeners.add(listener);
          return channel;
        },
        subscribe(callback?: (status: string) => void) {
          window.__mobileRealtime.subscribed = true;
          callback?.('SUBSCRIBED');
          return channel;
        },
        remove() { for (const listener of owned) listeners.delete(listener); },
      };
      return channel;
    },
    removeChannel(channel: { remove: () => void }) { channel.remove(); },
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
