import { useEffect, useRef, useState } from 'react';
import { getQuote } from '../api/stocks';

const POLL_INTERVAL = 30 * 1000;
// Saat pasar tutup tetap dicek berkala, supaya halaman yang dibuka sebelum
// bursa buka otomatis menjadi live tanpa perlu dimuat ulang.
const CLOSED_POLL_INTERVAL = 5 * 60 * 1000;

export default function useLiveQuote(stockId, onPrice) {
  const [state, setState] = useState({ isOpen: false, updatedAt: null, error: null });
  const onPriceRef = useRef(onPrice);

  useEffect(() => {
    onPriceRef.current = onPrice;
  });

  useEffect(() => {
    if (!stockId) return undefined;

    let cancelled = false;
    let timer = null;
    let lastOpen = true;

    const schedule = () => {
      clearTimeout(timer);
      if (!cancelled && document.visibilityState === 'visible') {
        timer = setTimeout(tick, lastOpen ? POLL_INTERVAL : CLOSED_POLL_INTERVAL);
      }
    };

    async function tick() {
      clearTimeout(timer);
      try {
        const quote = await getQuote(stockId);
        if (cancelled) return;
        lastOpen = quote.is_open;
        if (quote.price) onPriceRef.current?.(quote.price);
        setState({ isOpen: quote.is_open, updatedAt: quote.market_time || quote.fetched_at, error: null });
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({ ...prev, error }));
      }
      schedule();
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
      else clearTimeout(timer);
    };

    tick();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [stockId]);

  return state;
}
