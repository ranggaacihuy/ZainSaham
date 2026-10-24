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

function weekStart(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function monthBucket(months) {
  return (dateKey) => {
    const [y, m] = dateKey.split('-').map(Number);
    return `${y}-${Math.floor((m - 1) / months)}`;
  };
}

export const TIMEFRAMES = [
  { value: '1H', label: '1H', title: '1 hari', bucket: (dateKey) => dateKey },
  { value: '1Mg', label: '1Mg', title: '1 minggu', bucket: weekStart },
  { value: '1B', label: '1B', title: '1 bulan', bucket: monthBucket(1) },
  { value: '3B', label: '3B', title: '3 bulan', bucket: monthBucket(3) },
  { value: '6B', label: '6B', title: '6 bulan', bucket: monthBucket(6) },
  { value: '1T', label: '1T', title: '1 tahun', bucket: monthBucket(12) },
];

export function aggregatePrices(prices, timeframe) {
  if (!Array.isArray(prices)) return [];
  const option = TIMEFRAMES.find((t) => t.value === timeframe) || TIMEFRAMES[0];
  if (option === TIMEFRAMES[0]) return prices;

  const bars = [];
  let key = null;
  prices.forEach((p) => {
    const open = p.open_price ?? p.close_price;
    const high = p.high_price ?? Math.max(open, p.close_price);
    const low = p.low_price ?? Math.min(open, p.close_price);
    const bucket = option.bucket(p.price_date);

    if (bucket !== key) {
      key = bucket;
      bars.push({
        price_date: p.price_date,
        open_price: open,
        high_price: high,
        low_price: low,
        close_price: p.close_price,
        volume: p.volume ?? 0,
      });
      return;
    }

    const bar = bars[bars.length - 1];
    bar.high_price = Math.max(bar.high_price, high);
    bar.low_price = Math.min(bar.low_price, low);
    bar.close_price = p.close_price;
    bar.volume += p.volume ?? 0;
  });
  return bars;
}

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
