type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const entries = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(key: string, loader: () => Promise<T>, ttlMs: number): Promise<T> {
  const cached = entries.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const value = await loader();
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(key: string): void {
  entries.delete(key);
}