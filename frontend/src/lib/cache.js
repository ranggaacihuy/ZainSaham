/**
 * Cache in-memory sederhana berbasis promise.
 * - Permintaan yang sama untuk key yang sama hanya dikirim sekali (dedup).
 * - Hasil disimpan selama `ttl` ms. Error tidak disimpan.
 */
export function createCache(fetcher, { ttl = 5 * 60 * 1000 } = {}) {
  const store = new Map();

  function get(key, { force = false } = {}) {
    const hit = store.get(key);
    const fresh = hit && (hit.status === 'pending' || Date.now() - hit.time < ttl);
    if (hit && fresh && !force) return hit.promise;

    const entry = { status: 'pending', time: Date.now(), value: undefined };
    entry.promise = fetcher(key).then(
      (value) => {
        entry.status = 'done';
        entry.value = value;
        entry.time = Date.now();
        return value;
      },
      (error) => {
        if (store.get(key) === entry) store.delete(key);
        throw error;
      },
    );
    store.set(key, entry);
    return entry.promise;
  }

  function peek(key) {
    const hit = store.get(key);
    if (!hit || hit.status !== 'done') return undefined;
    if (Date.now() - hit.time >= ttl) return undefined;
    return hit.value;
  }

  function invalidate(key) {
    if (key === undefined) store.clear();
    else store.delete(key);
  }

  return { get, peek, invalidate };
}
