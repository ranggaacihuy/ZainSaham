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

  return { get };
}
