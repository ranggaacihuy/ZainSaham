import { withAlpha } from './chart';
import { number } from './format';

const STORAGE_PREFIX = 'zainsaham_drawings_v1_';

export const DRAWING_PRESETS = [
  { id: 'support', label: 'Support', short: 'S', token: 'up' },
  { id: 'resistance', label: 'Resistance', short: 'R', token: 'down' },
  { id: 'neutral', label: 'Sideways', short: 'T', token: 'iris' },
];

export function resolveDrawingColor(presetId, colors) {
  const fallback = {
    up: colors?.up || '#16a34a',
    down: colors?.down || '#dc2626',
    iris: getComputedStyle(document.documentElement).getPropertyValue('--color-iris').trim() || '#4b49aa',
  };
  const preset = DRAWING_PRESETS.find((p) => p.id === presetId) || DRAWING_PRESETS[2];
  return fallback[preset.token] || fallback.iris;
}

export function loadDrawings(ticker) {
  if (!ticker) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${String(ticker).toUpperCase()}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDrawings(ticker, items) {
  if (!ticker) return;
  try {
    const key = `${STORAGE_PREFIX}${String(ticker).toUpperCase()}`;
    if (!items.length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Abaikan jika storage penuh / private mode
  }
}

function nearestBarTime(bars, targetDate) {
  if (!bars?.length || !targetDate) return targetDate;
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].price_date < targetDate) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && bars[lo].price_date > targetDate) {
    return bars[lo - 1].price_date;
  }
  return bars[lo].price_date;
}

function toX(chart, bars, timeStr) {
  const timeScale = chart.timeScale();
  const direct = timeScale.timeToCoordinate(timeStr);
  if (direct !== null) return direct;
  const fallback = nearestBarTime(bars, timeStr);
  return timeScale.timeToCoordinate(fallback);
}

class DrawingsPaneRenderer {
  constructor(items) {
    this._items = items;
  }

  draw(target) {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const item of this._items) {
        ctx.save();
        if (item.type === 'trendline') {
          ctx.beginPath();
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.preview ? 1.5 : 2;
          if (item.preview) ctx.setLineDash([5, 4]);
          ctx.moveTo(item.x1, item.y1);
          ctx.lineTo(item.x2, item.y2);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = item.color;
          for (const [px, py] of [[item.x1, item.y1], [item.x2, item.y2]]) {
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }

          if (item.pctLabel) {
            ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
            const padX = 6;
            const tw = ctx.measureText(item.pctLabel).width;
            const bx = item.x2 + 8;
            const by = item.y2 - 10;
            ctx.fillStyle = withAlpha(item.color, 0.16);
            ctx.strokeStyle = withAlpha(item.color, 0.55);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx, by, tw + padX * 2, 20, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = item.color;
            ctx.textBaseline = 'middle';
            ctx.fillText(item.pctLabel, bx + padX, by + 10);
          }
        } else if (item.type === 'zone') {
          const left = Math.min(item.x1, item.x2);
          const top = Math.min(item.y1, item.y2);
          const w = Math.abs(item.x2 - item.x1);
          const h = Math.abs(item.y2 - item.y1);

          ctx.fillStyle = withAlpha(item.color, item.preview ? 0.1 : 0.16);
          ctx.strokeStyle = withAlpha(item.color, item.preview ? 0.6 : 0.85);
          ctx.lineWidth = 1.25;
          if (item.preview) ctx.setLineDash([5, 4]);

          ctx.fillRect(left, top, w, h);
          ctx.strokeRect(left, top, w, h);

          if (item.rangeLabel && w > 48) {
            ctx.setLineDash([]);
            ctx.font = '500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillStyle = item.color;
            ctx.textBaseline = 'top';
            ctx.fillText(item.rangeLabel, left + 6, top + 4);
          }
        }
        ctx.restore();
      }
    });
  }
}

class DrawingsPaneView {
  constructor(source) {
    this._source = source;
    this._items = [];
  }

  zOrder() {
    return 'top';
  }

  update() {
    const { _chart: chart, _series: series, _drawings: drawings, _preview: preview, _bars: bars, _colors: colors, _precision: precision } = this._source;
    if (!chart || !series) {
      this._items = [];
      return;
    }

    const list = preview ? [...drawings, { ...preview, preview: true }] : drawings;
    const mapped = [];

    for (const d of list) {
      if (d.type !== 'trendline' && d.type !== 'zone') continue;
      const x1 = toX(chart, bars, d.t1);
      const x2 = toX(chart, bars, d.t2);
      const y1 = series.priceToCoordinate(d.p1);
      const y2 = series.priceToCoordinate(d.p2);
      if (x1 === null || x2 === null || y1 === null || y2 === null) continue;

      const color = resolveDrawingColor(d.preset, colors);
      let pctLabel = null;
      let rangeLabel = null;

      if (d.type === 'trendline' && d.p1) {
        const pct = ((d.p2 - d.p1) / d.p1) * 100;
        const sign = pct > 0 ? '+' : '';
        pctLabel = `${sign}${pct.toFixed(1)}%`;
      } else if (d.type === 'zone') {
        const lo = Math.min(d.p1, d.p2);
        const hi = Math.max(d.p1, d.p2);
        rangeLabel = `${number(lo, precision)} – ${number(hi, precision)}`;
      }

      mapped.push({ type: d.type, x1, y1, x2, y2, color, preview: Boolean(d.preview), pctLabel, rangeLabel });
    }

    this._items = mapped;
  }

  renderer() {
    return new DrawingsPaneRenderer(this._items);
  }
}

export class DrawingPrimitive {
  constructor() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._drawings = [];
    this._preview = null;
    this._bars = [];
    this._colors = {};
    this._precision = 0;
    this._paneView = new DrawingsPaneView(this);
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
    this._requestUpdate();
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  setState({ drawings, preview, bars, colors, precision }) {
    if (drawings !== undefined) this._drawings = drawings;
    if (preview !== undefined) this._preview = preview;
    if (bars !== undefined) this._bars = bars;
    if (colors !== undefined) this._colors = colors;
    if (precision !== undefined) this._precision = precision;
    this._requestUpdate?.();
  }

  updateAllViews() {
    this._paneView.update();
  }

  paneViews() {
    return [this._paneView];
  }
}