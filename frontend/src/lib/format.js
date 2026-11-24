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

export function number(value, digits = 2) {
  if (!isNum(value)) return DASH;
  return nf(digits).format(value);
}

export function idr(value, { decimals = 0 } = {}) {
  if (!isNum(value)) return DASH;
  const formatted = nf(decimals).format(Math.abs(value));
  return `${value < 0 ? '-' : ''}Rp ${formatted}`;
}

export function pct(value, { digits = 2, sign = true } = {}) {
  if (!isNum(value)) return DASH;
  const formatted = nf(digits).format(Math.abs(value));
  const prefix = value > 0 && sign ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatted}%`;
}

export function signed(value, digits = 0) {
  if (!isNum(value)) return DASH;
  const formatted = nf(digits).format(Math.abs(value));
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatted}`;
}

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

export function idrCompact(value) {
  if (!isNum(value)) return DASH;
  const formatted = compact(Math.abs(value));
  return `${value < 0 ? '-' : ''}Rp ${formatted}`;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
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
const intradayDateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const intradayTimeFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const intradayDayFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
});

export function date(value) {
  const d = parseDate(value);
  return d ? dateFmt.format(d) : DASH;
}

export function dateTime(value) {
  const d = parseDate(value);
  return d ? dateTimeFmt.format(d) : DASH;
}

export function intradayDateTime(unixSeconds) {
  if (!isNum(unixSeconds)) return DASH;
  return `${intradayDateTimeFmt.format(new Date(unixSeconds * 1000))} WIB`;
}

export function intradayTick(unixSeconds, tickMarkType) {
  if (!isNum(unixSeconds)) return '';
  const d = new Date(unixSeconds * 1000);
  if (tickMarkType === 0) return String(d.getUTCFullYear());
  if (tickMarkType === 1 || tickMarkType === 2) return intradayDayFmt.format(d);
  return intradayTimeFmt.format(d);
}

export function toneOf(value) {
  if (!isNum(value) || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}
