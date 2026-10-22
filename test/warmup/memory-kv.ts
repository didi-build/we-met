type MemoryKvEntry = { value: string; expiresAt?: number };

/** Minimal in-memory KV for warmup unit tests (honors `expirationTtl` on put). */
export function createMemoryKv(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, MemoryKvEntry>();
  for (const [key, value] of Object.entries(initial)) {
    store.set(key, { value });
  }
  const now = () => Date.now();
  const getEntry = (key: string): MemoryKvEntry | undefined => {
    const entry = store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt !== undefined && now() >= entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    get: async (key: string) => getEntry(key)?.value ?? null,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      const expiresAt =
        options?.expirationTtl !== undefined
          ? now() + options.expirationTtl * 1000
          : undefined;
      store.set(key, { value, expiresAt });
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
      value: getEntry(key)?.value ?? null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}

export function warmupKvEnabled(): KVNamespace {
  return createMemoryKv({ enabled: "true" });
}
