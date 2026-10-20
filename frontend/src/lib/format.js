// Format angka & tanggal dengan locale id-ID.

const DASH = '–';

const numberFormatters = new Map();
function nf(minimumFractionDigits, maximumFractionDigits = minimumFractionDigits) {
  const key = `${minimumFractionDigits}-${maximumFractionDigits}`;
  if (!numberFormatters.has(key)) {
    numberFormatters.set(
      key,
      new Intl.NumberFormat('id-ID', { minimumFractionDigits, maximumFractionDigits }),
    );
  }
  return numberFormatters.get(key);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Angka biasa: number(1234.5, 2) → "1.234,50" */
export function number(value, digits = 2) {
  if (!isNum(value)) return DASH;
  return nf(digits).format(value);
}

/** Rupiah: idr(9250) → "Rp 9.250". Default tanpa desimal untuk harga IDR. */
export function idr(value, { decimals = 0 } = {}) {
  if (!isNum(value)) return DASH;
  const formatted = nf(decimals).format(Math.abs(value));
  return `${value < 0 ? '-' : ''}Rp ${formatted}`;
}

/** Persen dengan tanda eksplisit: pct(1.25) → "+1,25%" */
export function pct(value, { digits = 2, sign = true } = {}) {
  if (!isNum(value)) return DASH;
  const formatted = nf(digits).format(Math.abs(value));
  const prefix = value > 0 && sign ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatted}%`;
}

/** Perubahan nilai dengan tanda: signed(25) → "+25" */
export function signed(value, digits = 0) {
  if (!isNum(value)) return DASH;
  const formatted = nf(digits).format(Math.abs(value));
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatted}`;
}

/** Angka ringkas: compact(12_400_000) → "12,4 jt" */
export function compact(value) {
  if (!isNum(value)) return DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const units = [
    [1e12, 'T'],
    [1e9, 'M'],
    [1e6, 'jt'],
    [1e3, 'rb'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}${nf(0, 1).format(abs / size)} ${suffix}`;
  }
  return `${sign}${nf(0, 0).format(abs)}`;
}

/** Rupiah ringkas: idrCompact(1.2e12) → "Rp 1,2 T" */
export function idrCompact(value) {
  if (!isNum(value)) return DASH;
  const formatted = compact(Math.abs(value));
  return `${value < 0 ? '-' : ''}Rp ${formatted}`;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  // "YYYY-MM-DD" diperlakukan sebagai tanggal lokal agar tidak bergeser zona waktu.
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const shortDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const monthYearFmt = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' });

/** date("2026-10-20") → "20 Okt 2026" */
export function date(value) {
  const d = parseDate(value);
  return d ? dateFmt.format(d) : DASH;
}

/** dateTime(iso) → "20 Okt 2026, 09.23" */
export function dateTime(value) {
  const d = parseDate(value);
  return d ? dateTimeFmt.format(d) : DASH;
}

/** Label sumbu grafik: "20 Okt" atau "Okt 26" untuk rentang panjang. */
export function axisDate(value, long = false) {
  const d = parseDate(value);
  if (!d) return '';
  return long ? monthYearFmt.format(d) : shortDateFmt.format(d);
}

export function toneOf(value) {
  if (!isNum(value) || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}

