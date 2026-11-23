type Entry = { exp: number; value: unknown };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = load()
    .then((value) => {
      store.set(key, { exp: Date.now() + ttlMs, value });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });
  inflight.set(key, promise);
  return promise;
}

export function clearCache(): void {
  store.clear();
  inflight.clear();
}
