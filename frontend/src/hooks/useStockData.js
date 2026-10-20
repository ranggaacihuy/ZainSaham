import { useCallback, useEffect, useState } from 'react';
import { mapLimit } from '../lib/cache';
import { getIndicators, getPrices, peekIndicators, peekPrices } from '../api/stocks';
import { lastValue, summarizePrices } from '../lib/market';

/**
 * Muat data per-ID secara lazy dengan konkurensi terbatas.
 * Hanya ID yang diberikan yang di-fetch; data yang sudah ada di cache langsung dipakai.
 *
 * @param {number[]} ids
 * @param {{ load: (id) => Promise<any>, peek: (id) => any, limit?: number }} source
 * @returns {{ entries: Record<number, {status: 'loading'|'done'|'error', value?: any, error?: any}>, retry: (id) => void }}
 */
export function useBatchedResource(ids, { load, peek, limit = 5 }) {
  const key = ids.filter((id) => id !== null && id !== undefined).join(',');
  const [entries, setEntries] = useState({});
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(',').map(Number) : [];
    const cached = {};
    const missing = [];

    list.forEach((id) => {
      const value = peek(id);
      if (value !== undefined) cached[id] = { status: 'done', value };
      else missing.push(id);
    });

    setEntries((prev) => {
      const next = { ...prev, ...cached };
      missing.forEach((id) => {
        if (next[id]?.status !== 'done') next[id] = { status: 'loading' };
      });
      return next;
    });

    mapLimit(missing, limit, async (id) => {
      if (cancelled) return;
      try {
        const value = await load(id);
        if (!cancelled) setEntries((prev) => ({ ...prev, [id]: { status: 'done', value } }));
      } catch (error) {
        if (!cancelled) setEntries((prev) => ({ ...prev, [id]: { status: 'error', error } }));
      }
    });

    return () => {
      cancelled = true;
    };
    // load/peek dianggap stabil (fungsi modul).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit, retryTick]);

  const retry = useCallback(() => setRetryTick((t) => t + 1), []);

  return { entries, retry };
}

const priceSource = { load: (id) => getPrices(id), peek: (id) => peekPrices(id) };
const indicatorSource = { load: (id) => getIndicators(id), peek: (id) => peekIndicators(id) };

/** Harga per saham → { status, prices, summary, error } */
export function usePriceSummaries(ids) {
  const { entries, retry } = useBatchedResource(ids, priceSource);
  const result = {};
  Object.entries(entries).forEach(([id, entry]) => {
    result[id] = {
      status: entry.status,
      error: entry.error,
      prices: entry.value,
      summary: entry.status === 'done' ? summarizePrices(entry.value) : null,
    };
  });
  return { summaries: result, retry };
}

/** RSI 14 terakhir (tidak null) per saham → { status, rsi, error } */
export function useLatestRsi(ids) {
  const { entries, retry } = useBatchedResource(ids, indicatorSource);
  const result = {};
  Object.entries(entries).forEach(([id, entry]) => {
    result[id] = {
      status: entry.status,
      error: entry.error,
      rsi: entry.status === 'done' ? lastValue(entry.value, 'rsi_14') : null,
    };
  });
  return { rsi: result, retry };
}

