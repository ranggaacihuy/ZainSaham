import { useEffect, useRef } from 'react';

export default function AuthChartBackground({
  accent = 'monochrome', // 'monochrome' | 'emerald'
  compact = false,
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let animationFrameId = null;
    let width = 0;
    let height = 0;

    const CANDLE_COUNT = compact ? 28 : 42;
    const CANDLE_STEP = compact ? 20 : 26;
    const CANDLE_WIDTH = compact ? 7 : 10;
    const NEW_CANDLE_INTERVAL = 2600;
    const TICK_INTERVAL = 380;

    const createInitialCandles = () => {
      const data = [];
      let price = 100;
      for (let i = 0; i < CANDLE_COUNT; i++) {
        const open = price;
        const delta = (Math.random() - 0.44) * 5.2;
        const close = Math.max(60, open + delta);
        const high = Math.max(open, close) + Math.random() * 2.8;
        const low = Math.min(open, close) - Math.random() * 2.8;
        data.push({ open, high, low, close });
        price = close;
      }
      return data;
    };

    const candles = createInitialCandles();
    let targetClose = candles[candles.length - 1].close;
    let slideOffset = 0;
    let lastTime = performance.now();
    let candleTimer = 0;
    let tickTimer = 0;

    let viewMin = Math.min(...candles.map((c) => c.low));
    let viewMax = Math.max(...candles.map((c) => c.high));

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const renderFrame = (now) => {
      // Lewati render saat container sedang hidden (mobile vs desktop)
      if (width === 0 || height === 0) {
        if (!prefersReducedMotion) {
          animationFrameId = requestAnimationFrame(renderFrame);
        }
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const last = candles[candles.length - 1];

      if (!prefersReducedMotion) {
        candleTimer += dt * 1000;
        tickTimer += dt * 1000;

        // Micro-tick candle aktif
        if (tickTimer >= TICK_INTERVAL) {
          tickTimer = 0;
          const nudge = (Math.random() - 0.47) * 2.4;
          targetClose = Math.max(60, last.open + (last.close - last.open) + nudge);
        }

        last.close += (targetClose - last.close) * Math.min(1, dt * 6);
        last.high = Math.max(last.high, last.open, last.close);
        last.low = Math.min(last.low, last.open, last.close);

        // Tambah candle baru dan geser mulus ke kiri
        if (candleTimer >= NEW_CANDLE_INTERVAL) {
          candleTimer = 0;
          const nextOpen = last.close;
          const meanPull = nextOpen > 165 ? -1.8 : nextOpen < 85 ? 1.8 : 0.3;
          const initDelta = (Math.random() - 0.48) * 2 + meanPull;
          const nextClose = nextOpen + initDelta;

          candles.shift();
          candles.push({
            open: nextOpen,
            close: nextClose,
            high: Math.max(nextOpen, nextClose) + Math.random() * 0.8,
            low: Math.min(nextOpen, nextClose) - Math.random() * 0.8,
          });
          targetClose = nextClose;
          slideOffset += CANDLE_STEP;
        }

        slideOffset += (0 - slideOffset) * Math.min(1, dt * 4.5);
      }

      // Auto-scale sumbu Y
      const targetMin = Math.min(...candles.map((c) => c.low));
      const targetMax = Math.max(...candles.map((c) => c.high));
      viewMin += (targetMin - viewMin) * Math.min(1, dt * 2.5);
      viewMax += (targetMax - viewMax) * Math.min(1, dt * 2.5);

      const range = Math.max(viewMax - viewMin, 10);
      const topPadding = compact ? height * 0.18 : height * 0.38;
      const bottomPadding = height * 0.1;
      const chartHeight = Math.max(height - topPadding - bottomPadding, 20);

      const priceToY = (price) =>
        topPadding + ((viewMax - price) / range) * chartHeight;

      const rightAnchor = width * 0.88;

      ctx.clearRect(0, 0, width, height);

      // Grid halus
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.lineWidth = 1;
      const gridSize = compact ? 36 : 48;

      ctx.beginPath();
      for (let x = (width % gridSize) / 2; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = (height % gridSize) / 2; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Garis diagonal arsitektural tipis
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.78);
      ctx.lineTo(width, height * 0.22);
      ctx.moveTo(0, height * 0.94);
      ctx.lineTo(width, height * 0.38);
      ctx.stroke();

      // Garis EMA-6 + area glow
      const emaPoints = [];
      let ema = candles[0].close;
      const k = 2 / (6 + 1);

      candles.forEach((c, i) => {
        ema = c.close * k + ema * (1 - k);
        const x = rightAnchor - (candles.length - 1 - i) * CANDLE_STEP + slideOffset;
        emaPoints.push({ x, y: priceToY(ema) });
      });

      if (emaPoints.length > 1) {
        const areaGrad = ctx.createLinearGradient(0, topPadding, 0, height);
        if (accent === 'emerald') {
          areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
          areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else {
          areaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
          areaGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.beginPath();
        ctx.moveTo(emaPoints[0].x, emaPoints[0].y);
        for (let i = 1; i < emaPoints.length - 1; i++) {
          const xc = (emaPoints[i].x + emaPoints[i + 1].x) / 2;
          const yc = (emaPoints[i].y + emaPoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(emaPoints[i].x, emaPoints[i].y, xc, yc);
        }
        const lastEma = emaPoints[emaPoints.length - 1];
        ctx.lineTo(lastEma.x, lastEma.y);
        ctx.lineTo(lastEma.x, height);
        ctx.lineTo(emaPoints[0].x, height);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(emaPoints[0].x, emaPoints[0].y);
        for (let i = 1; i < emaPoints.length - 1; i++) {
          const xc = (emaPoints[i].x + emaPoints[i + 1].x) / 2;
          const yc = (emaPoints[i].y + emaPoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(emaPoints[i].x, emaPoints[i].y, xc, yc);
        }
        ctx.lineTo(lastEma.x, lastEma.y);
        ctx.strokeStyle =
          accent === 'emerald'
            ? 'rgba(52, 211, 153, 0.45)'
            : 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Render Candlesticks
      candles.forEach((c, i) => {
        const x = rightAnchor - (candles.length - 1 - i) * CANDLE_STEP + slideOffset;
        if (x < -CANDLE_STEP || x > width + CANDLE_STEP) return;

        const yOpen = priceToY(c.open);
        const yClose = priceToY(c.close);
        const yHigh = priceToY(c.high);
        const yLow = priceToY(c.low);

        const isBull = c.close >= c.open;
        const isCurrent = i === candles.length - 1;
        const edgeFade = Math.min(1, Math.max(0.1, x / (width * 0.22)));

        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(Math.abs(yClose - yOpen), 2);

        const wickColor =
          accent === 'emerald'
            ? isBull
              ? `rgba(52, 211, 153, ${0.42 * edgeFade})`
              : `rgba(148, 163, 184, ${0.28 * edgeFade})`
            : `rgba(255, 255, 255, ${(isBull ? 0.34 : 0.18) * edgeFade})`;

        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        if (isBull) {
          ctx.fillStyle =
            accent === 'emerald'
              ? `rgba(16, 185, 129, ${(isCurrent ? 0.35 : 0.18) * edgeFade})`
              : `rgba(255, 255, 255, ${(isCurrent ? 0.22 : 0.1) * edgeFade})`;
          ctx.strokeStyle =
            accent === 'emerald'
              ? `rgba(52, 211, 153, ${(isCurrent ? 0.85 : 0.5) * edgeFade})`
              : `rgba(255, 255, 255, ${(isCurrent ? 0.72 : 0.38) * edgeFade})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.04 * edgeFade})`;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 * edgeFade})`;
        }

        ctx.fillRect(x - CANDLE_WIDTH / 2, bodyTop, CANDLE_WIDTH, bodyHeight);
        ctx.strokeRect(x - CANDLE_WIDTH / 2, bodyTop, CANDLE_WIDTH, bodyHeight);
      });

      // Garis harga aktif + pulse dot
      const activeX = rightAnchor + slideOffset;
      const activeY = priceToY(last.close);

      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle =
        accent === 'emerald'
          ? 'rgba(52, 211, 153, 0.35)'
          : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, activeY);
      ctx.lineTo(width, activeY);
      ctx.stroke();
      ctx.restore();

      const pulse = prefersReducedMotion ? 0.35 : (Math.sin(now / 450) + 1) / 2;
      const dotColor = accent === 'emerald' ? '52, 211, 153' : '255, 255, 255';

      ctx.beginPath();
      ctx.arc(activeX, activeY, 4 + pulse * 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${dotColor}, ${0.22 * (1 - pulse)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(activeX, activeY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${dotColor}, 0.9)`;
      ctx.fill();

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(renderFrame);
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (prefersReducedMotion) {
        renderFrame(performance.now());
      }
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    animationFrameId = requestAnimationFrame(renderFrame);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [accent, compact]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-obsidian ${className}`}>
      {/* Ambient highlight lembut di kanan atas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 80% 18%, rgba(255,255,255,0.08) 0%, rgba(11,12,14,0) 55%)',
        }}
      />

      {/* Canvas Chart */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Vignette agar teks tetap tajam */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(11,12,14,0.72) 0%, rgba(11,12,14,0.22) 45%, rgba(11,12,14,0.68) 100%)',
        }}
      />
    </div>
  );
}