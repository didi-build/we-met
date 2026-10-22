/** Minimal in-memory KV for warmup unit tests. */
export function createMemoryKv(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({
      keys: [],
      list_complete: true,
      cacheStatus: null,
    }),
    getWithMetadata: async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}

export function warmupKvEnabled(): KVNamespace {
  return createMemoryKv({ enabled: "true" });
}
