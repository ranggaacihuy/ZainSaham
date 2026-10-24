// Perhitungan pasar di sisi frontend untuk grafik dan halaman detail saham.

/**
 * Ringkasan harga dari array harga (urut lama → baru).
 * Perubahan dihitung dari dua data terakhir.
 */
export function summarizePrices(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const last = prices[prices.length - 1];
  const prev = prices.length > 1 ? prices[prices.length - 2] : null;
  const close = last.close_price;
  const prevClose = prev ? prev.close_price : null;
  const hasChange = close !== null && prevClose !== null && prevClose !== 0;
  const changeValue = hasChange ? close - prevClose : null;

  return {
    date: last.price_date,
    close,
    prev_close: prevClose,
    change_value: changeValue,
    change_pct: hasChange ? (changeValue / prevClose) * 100 : null,
    open: last.open_price,
    high: last.high_price,
    low: last.low_price,
    volume: last.volume,
  };
}

export const RANGES = [
  { value: '1B', label: '1B', months: 1 },
  { value: '3B', label: '3B', months: 3 },
  { value: '6B', label: '6B', months: 6 },
  { value: '1T', label: '1T', months: 12 },
  { value: '5T', label: '5T', months: 60 },
];

function subtractMonths(dateKey, months) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, d));
  return date.toISOString().slice(0, 10);
}

/**
 * Filter array berurutan berdasarkan rentang waktu, dihitung mundur dari data terakhir.
 * Mengembalikan { items, isPartial, since } — isPartial true bila data lebih pendek dari rentang.
 */
export function filterByRange(items, range, dateField = 'price_date') {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], isPartial: false, since: null };
  }
  const option = RANGES.find((r) => r.value === range) || RANGES[1];
  const lastKey = items[items.length - 1][dateField];
  const firstKey = items[0][dateField];
  const cutoff = subtractMonths(lastKey, option.months);
  const filtered = items.filter((item) => item[dateField] >= cutoff);
  return {
    items: filtered,
    isPartial: firstKey > cutoff,
    since: firstKey,
  };
}

/**
 * Deskripsi indikator teknikal terakhir.
 * tone: 'up' | 'down' | 'warn' | 'neutral'
 */
export function describeIndicators(indicator, lastClose) {
  const rsi = indicator?.rsi_14 ?? null;
  const macd = indicator?.macd ?? null;
  const signal = indicator?.macd_signal ?? null;
  const sma20 = indicator?.sma_20 ?? null;
  const sma50 = indicator?.sma_50 ?? null;

  let rsiInfo = { value: rsi, label: 'Data tidak tersedia', tone: 'neutral' };
  if (rsi !== null) {
    if (rsi >= 70) rsiInfo = { value: rsi, label: 'Jenuh beli', tone: 'warn' };
    else if (rsi <= 30) rsiInfo = { value: rsi, label: 'Jenuh jual', tone: 'warn' };
    else rsiInfo = { value: rsi, label: 'Netral', tone: 'neutral' };
  }

  let macdInfo = { macd, signal, label: 'Data tidak tersedia', tone: 'neutral' };
  if (macd !== null && signal !== null) {
    if (macd > signal) macdInfo = { macd, signal, label: 'MACD di atas signal', tone: 'up' };
    else if (macd < signal) macdInfo = { macd, signal, label: 'MACD di bawah signal', tone: 'down' };
    else macdInfo = { macd, signal, label: 'MACD sama dengan signal', tone: 'neutral' };
  }

  let smaInfo = { sma20, sma50, label: 'Data tidak tersedia', tone: 'neutral' };
  if (lastClose !== null && lastClose !== undefined && sma20 !== null && sma50 !== null) {
    if (lastClose > sma20 && lastClose > sma50) {
      smaInfo = { sma20, sma50, label: 'Harga di atas SMA 20 dan SMA 50', tone: 'up' };
    } else if (lastClose < sma20 && lastClose < sma50) {
      smaInfo = { sma20, sma50, label: 'Harga di bawah SMA 20 dan SMA 50', tone: 'down' };
    } else {
      smaInfo = { sma20, sma50, label: 'Harga di antara SMA 20 dan SMA 50', tone: 'neutral' };
    }
  }

  return { date: indicator?.indicator_date ?? null, rsi: rsiInfo, macd: macdInfo, sma: smaInfo };
}

/**
 * Klasifikasi periode fundamental berdasarkan `period_type` dari backend (atau pola teks bila kosong).
 * Toggle kuartalan/tahunan hanya ditampilkan bila SEMUA periode bisa diklasifikasikan
 * dan kedua jenis memang ada. Selain itu tampilkan semua periode apa adanya.
 */
const ANNUAL_PATTERN = /^(FY\s?)?\d{4}$/i;
const QUARTER_PATTERN = /^(\d{4}[\s\-/]?Q[1-4]|Q[1-4][\s\-/]?\d{4})$/i;

function periodType(fundamental) {
  if (fundamental.period_type) return fundamental.period_type;
  const period = fundamental.period.trim();
  if (QUARTER_PATTERN.test(period)) return 'quarterly';
  if (ANNUAL_PATTERN.test(period)) return 'annual';
  return '';
}

export function classifyPeriods(fundamentals) {
  if (!Array.isArray(fundamentals) || fundamentals.length === 0) {
    return { canToggle: false, quarterly: [], annual: [] };
  }
  const quarterly = [];
  const annual = [];
  let unknown = 0;
  fundamentals.forEach((f) => {
    const type = periodType(f);
    if (type === 'quarterly') quarterly.push(f);
    else if (type === 'annual') annual.push(f);
    else unknown += 1;
  });
  return {
    canToggle: unknown === 0 && quarterly.length > 0 && annual.length > 0,
    quarterly,
    annual,
  };
}

