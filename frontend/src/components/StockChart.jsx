import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Calendar, Layers } from 'lucide-react';

export default function StockChart({ prices = [], currentRange = '3B', onRangeChange, ticker = '' }) {
  const [chartMode, setChartMode] = useState('candle'); // 'candle' | 'line'
  const [hoverIndex, setHoverIndex] = useState(null);

  const ranges = ['1B', '3B', '6B', '1T', '5T'];

  // Calculations for chart geometry
  const chartData = useMemo(() => {
    if (!prices || prices.length === 0) return null;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    prices.forEach((p) => {
      if (p.low_price < minPrice) minPrice = p.low_price;
      if (p.high_price > maxPrice) maxPrice = p.high_price;
      if (p.volume > maxVol) maxVol = p.volume;
    });

    const padding = (maxPrice - minPrice) * 0.08 || 10;
    const yMin = Math.max(0, minPrice - padding);
    const yMax = maxPrice + padding;

    return {
      minPrice,
      maxPrice,
      yMin,
      yMax,
      maxVol,
      count: prices.length,
    };
  }, [prices]);

  const activePoint = hoverIndex !== null && prices[hoverIndex] ? prices[hoverIndex] : (prices.length > 0 ? prices[prices.length - 1] : null);

  if (!prices || prices.length === 0 || !chartData) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#0c121e] rounded-2xl border border-slate-800 text-slate-400">
        <BarChart3 className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
        <p className="font-medium text-slate-300">Data harga belum tersedia untuk rentang ini</p>
      </div>
    );
  }

  const svgWidth = 840;
  const priceHeight = 240;
  const volumeHeight = 65;
  const gap = 20;
  const totalSvgHeight = priceHeight + gap + volumeHeight;

  const getX = (idx) => {
    if (chartData.count <= 1) return svgWidth / 2;
    return (idx / (chartData.count - 1)) * (svgWidth - 30) + 15;
  };

  const getY = (val) => {
    const range = chartData.yMax - chartData.yMin;
    if (range === 0) return priceHeight / 2;
    return priceHeight - ((val - chartData.yMin) / range) * (priceHeight - 20) - 10;
  };

  const getVolY = (vol) => {
    if (chartData.maxVol === 0) return totalSvgHeight;
    const height = (vol / chartData.maxVol) * (volumeHeight - 10);
    return totalSvgHeight - height;
  };

  // Build SVG path for line chart
  const linePoints = prices
    .map((p, i) => `${getX(i)},${getY(p.close_price)}`)
    .join(' ');

  const areaPoints = `${getX(0)},${priceHeight} ${linePoints} ${getX(prices.length - 1)},${priceHeight}`;

  return (
    <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 shadow-xl relative overflow-hidden">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange?.(r)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentRange === r
                  ? 'bg-[#CCFF00] text-[#080C14] shadow-[0_0_15px_rgba(204,255,0,0.35)]'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartMode(chartMode === 'candle' ? 'line' : 'candle')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-300 hover:text-[#CCFF00] hover:bg-slate-800 transition border border-slate-700/50"
          >
            <Layers className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>Mode: {chartMode === 'candle' ? 'Candlestick' : 'Line'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Hover / Active Price Inspector */}
      {activePoint && (
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono mb-3 bg-[#080c14]/70 px-4 py-2 rounded-xl border border-slate-800/80 text-slate-300">
          <span className="text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#CCFF00]" />
            {activePoint.price_date}
          </span>
          <span>
            Open: <strong className="text-white">Rp {activePoint.open_price.toLocaleString('id-ID')}</strong>
          </span>
          <span>
            High: <strong className="text-emerald-400">Rp {activePoint.high_price.toLocaleString('id-ID')}</strong>
          </span>
          <span>
            Low: <strong className="text-rose-400">Rp {activePoint.low_price.toLocaleString('id-ID')}</strong>
          </span>
          <span>
            Close:{' '}
            <strong
              className={
                activePoint.close_price >= activePoint.open_price ? 'text-emerald-400' : 'text-rose-400'
              }
            >
              Rp {activePoint.close_price.toLocaleString('id-ID')}
            </strong>
          </span>
          <span>
            Vol: <strong className="text-slate-200">{(activePoint.volume / 1000000).toFixed(2)}M</strong>
          </span>
        </div>
      )}

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${totalSvgHeight}`}
          className="w-full h-80 select-none cursor-crosshair"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            const index = Math.round(
              ((mouseX - 15) / (svgWidth - 30)) * (chartData.count - 1)
            );
            if (index >= 0 && index < chartData.count) {
              setHoverIndex(index);
            }
          }}
        >
          <defs>
            <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CCFF00" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#CCFF00" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gridGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={priceHeight * 0.25} x2={svgWidth} y2={priceHeight * 0.25} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1={priceHeight * 0.5} x2={svgWidth} y2={priceHeight * 0.5} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1={priceHeight * 0.75} x2={svgWidth} y2={priceHeight * 0.75} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1={priceHeight} x2={svgWidth} y2={priceHeight} stroke="#334155" />
          <line x1="0" y1={priceHeight + gap} x2={svgWidth} y2={priceHeight + gap} stroke="#1e293b" />

          {/* Volume divider label */}
          <text x="15" y={priceHeight + gap - 5} fill="#64748b" fontSize="10" fontFamily="monospace">
            VOLUME TRANSAKSI
          </text>

          {/* Price level labels */}
          <text x={svgWidth - 65} y="20" fill="#94a3b8" fontSize="11" fontFamily="monospace">
            {Math.round(chartData.yMax).toLocaleString('id-ID')}
          </text>
          <text x={svgWidth - 65} y={priceHeight - 10} fill="#94a3b8" fontSize="11" fontFamily="monospace">
            {Math.round(chartData.yMin).toLocaleString('id-ID')}
          </text>

          {/* Render Line Mode */}
          {chartMode === 'line' && (
            <>
              <polygon points={areaPoints} fill="url(#neonGradient)" />
              <polyline
                fill="none"
                stroke="#CCFF00"
                strokeWidth="2.5"
                points={linePoints}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Render Candlesticks */}
          {chartMode === 'candle' &&
            prices.map((p, idx) => {
              const x = getX(idx);
              const isUp = p.close_price >= p.open_price;
              const openY = getY(p.open_price);
              const closeY = getY(p.close_price);
              const highY = getY(p.high_price);
              const lowY = getY(p.low_price);
              const candleWidth = Math.max(3, Math.min(10, (svgWidth / chartData.count) * 0.65));
              const top = Math.min(openY, closeY);
              const height = Math.max(2, Math.abs(closeY - openY));
              const color = isUp ? '#10B981' : '#F43F5E';

              return (
                <g key={p.price_id || idx}>
                  {/* Candle Wick */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={top}
                    width={candleWidth}
                    height={height}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}

          {/* Render Volume Bars */}
          {prices.map((p, idx) => {
            const x = getX(idx);
            const isUp = p.close_price >= p.open_price;
            const y = getVolY(p.volume);
            const height = totalSvgHeight - y;
            const barWidth = Math.max(2, Math.min(8, (svgWidth / chartData.count) * 0.55));
            const color = isUp ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';

            return (
              <rect
                key={`vol-${p.price_id || idx}`}
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={height}
                fill={color}
              />
            );
          })}

          {/* Interactive Crosshair when hovered */}
          {hoverIndex !== null && prices[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1="0"
                x2={getX(hoverIndex)}
                y2={totalSvgHeight}
                stroke="#CCFF00"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.8"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(prices[hoverIndex].close_price)}
                r="4.5"
                fill="#CCFF00"
                stroke="#080C14"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
