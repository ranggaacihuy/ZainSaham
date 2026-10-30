import { ColorType, CrosshairMode, LineStyle, createChart } from 'lightweight-charts';
import { compact, date, number } from './format';

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

export function chartColors() {
  return {
    surface: token('surface'),
    border: token('border'),
    muted: token('text-muted'),
    accent: token('accent'),
    up: token('up'),
    down: token('down'),
  };
}

export function withAlpha(hex, alpha) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function timeKey(time) {
  if (typeof time === 'string') return time;
  if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${time.year}-${pad(time.month)}-${pad(time.day)}`;
}

export function priceFormat(precision) {
  return { type: 'custom', minMove: 1 / 10 ** precision, formatter: (value) => number(value, precision) };
}

export const volumeFormat = { type: 'custom', minMove: 1, formatter: compact };

export function chartThemeOptions(colors) {
  const crosshairLine = { color: colors.muted, style: LineStyle.Dashed, labelBackgroundColor: colors.border };
  return {
    layout: {
      background: { type: ColorType.Solid, color: colors.surface },
      textColor: colors.muted,
      fontFamily: getComputedStyle(document.body).fontFamily,
      fontSize: 12,
      attributionLogo: true,
      panes: { separatorColor: colors.border, separatorHoverColor: withAlpha(colors.muted, 0.2) },
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: colors.border },
    },
    crosshair: { mode: CrosshairMode.Normal, vertLine: crosshairLine, horzLine: crosshairLine },
  };
}

export function createThemedChart(container, colors) {
  return createChart(container, {
    autoSize: true,
    ...chartThemeOptions(colors),
    rightPriceScale: { borderVisible: false, minimumWidth: 64 },
    timeScale: {
      borderVisible: false,
      rightOffset: 0,
      minBarSpacing: 0.5,
      maxBarSpacing: 40,
      fixLeftEdge: true,
      fixRightEdge: true,
      lockVisibleTimeRangeOnResize: true,
    },
    handleScroll: { vertTouchDrag: false },
    localization: { locale: 'id-ID', timeFormatter: (time) => date(timeKey(time)) },
  });
}

export function showLatest(chart) {
  chart.timeScale().fitContent();
}

export function continuesSeries(previous, next, dateField) {
  if (!previous || previous.length < 2) return false;
  const added = next.length - previous.length;
  if (added !== 0 && added !== 1) return false;
  return next[previous.length - 2][dateField] === previous[previous.length - 2][dateField];
}
