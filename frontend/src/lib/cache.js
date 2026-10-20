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

/**
 * Jalankan `fn` untuk setiap item dengan konkurensi terbatas.
 * Hasilnya berbentuk seperti Promise.allSettled.
 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

