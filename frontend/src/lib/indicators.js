function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ema(values, n) {
  const out = new Array(values.length).fill(null);
  const start = values.findIndex((value) => value !== null);
  if (start < 0 || values.length - start < n) return out;

  const k = 2 / (n + 1);
  let previous = mean(values.slice(start, start + n));
  out[start + n - 1] = previous;
  for (let i = start + n; i < values.length; i++) {
    previous = values[i] * k + previous * (1 - k);
    out[i] = previous;
  }
  return out;
}

function rsi(closes, n) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < n + 1) return out;

  const strength = (gain, loss) => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const diff = closes[i] - closes[i - 1];
    gain += Math.max(diff, 0);
    loss += Math.max(-diff, 0);
  }
  gain /= n;
  loss /= n;
  out[n] = strength(gain, loss);

  for (let i = n + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(diff, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-diff, 0)) / n;
    out[i] = strength(gain, loss);
  }
  return out;
}

export function indicatorSeries(bars) {
  const closes = bars.map((bar) => bar.close_price);
  const rsi14 = rsi(closes, 14);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = closes.map((_, i) => (ema26[i] === null ? null : ema12[i] - ema26[i]));
  const signal = ema(macd, 9);

  return bars.map((bar, i) => ({
    indicator_date: bar.price_date,
    rsi_14: rsi14[i],
    macd: macd[i],
    macd_signal: signal[i],
  }));
}
