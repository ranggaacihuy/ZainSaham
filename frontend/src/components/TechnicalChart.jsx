import React, { useState } from 'react';
import { Activity, Gauge, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function TechnicalChart({ indicators = {}, ticker = '' }) {
  const { history = [], latest = {} } = indicators;
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-[#0c121e] rounded-2xl border border-slate-800 text-slate-400">
        <Activity className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
        <p className="font-medium text-slate-300">Data indikator teknikal belum tersedia</p>
      </div>
    );
  }

  const activeInd = hoverIdx !== null && history[hoverIdx] ? history[hoverIdx] : latest;

  const count = history.length;
  const svgWidth = 840;
  const rsiHeight = 160;
  const macdHeight = 160;

  const getX = (idx) => {
    if (count <= 1) return svgWidth / 2;
    return (idx / (count - 1)) * (svgWidth - 40) + 20;
  };

  // RSI scale (0 to 100)
  const getRsiY = (val) => {
    const clamped = Math.max(0, Math.min(100, val || 50));
    return rsiHeight - (clamped / 100) * (rsiHeight - 20) - 10;
  };

  // MACD scale
  let minMacd = -30;
  let maxMacd = 30;
  history.forEach((h) => {
    if (h.macd !== null) {
      if (h.macd < minMacd) minMacd = h.macd;
      if (h.macd > maxMacd) maxMacd = h.macd;
    }
    if (h.macd_signal !== null) {
      if (h.macd_signal < minMacd) minMacd = h.macd_signal;
      if (h.macd_signal > maxMacd) maxMacd = h.macd_signal;
    }
  });
  const macdRange = (maxMacd - minMacd) * 1.15 || 20;

  const getMacdY = (val) => {
    if (val === null || val === undefined) return macdHeight / 2;
    return macdHeight - ((val - minMacd) / macdRange) * (macdHeight - 20) - 10;
  };

  const rsiPoints = history
    .map((h, i) => `${getX(i)},${getRsiY(h.rsi_14)}`)
    .join(' ');

  const macdPoints = history
    .filter((h) => h.macd !== null)
    .map((h, i) => `${getX(i)},${getMacdY(h.macd)}`)
    .join(' ');

  const signalPoints = history
    .filter((h) => h.macd_signal !== null)
    .map((h, i) => `${getX(i)},${getMacdY(h.macd_signal)}`)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* 3 Summary Indicator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* RSI 14 Card */}
        <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 hover:border-[#CCFF00]/40 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Gauge className="w-4 h-4 text-[#CCFF00]" />
              RSI (14)
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                latest.rsi_14 >= 70
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : latest.rsi_14 <= 30
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'badge-stabilo'
              }`}
            >
              {latest.rsi_label || 'Netral'}
            </span>
          </div>
          <div className="text-3xl font-bold font-mono text-white mb-1">
            {latest.rsi_14 ?? '-'}
          </div>
          <p className="text-xs text-slate-400">
            {latest.rsi_14 >= 70
              ? 'Potensi jenuh beli. Waspadai pembalikan arah harga.'
              : latest.rsi_14 <= 30
              ? 'Potensi jenuh jual. Peluang rebound teknikal.'
              : 'Momentum harga berada dalam rentang normal.'}
          </p>
        </div>

        {/* MACD Card */}
        <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 hover:border-[#CCFF00]/40 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-4 h-4 text-[#CCFF00]" />
              MACD / Signal
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                latest.macd > latest.macd_signal
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {latest.macd > latest.macd_signal ? 'Bullish' : 'Bearish'}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mb-1">
            <span className="text-[#CCFF00]">{latest.macd ?? '-'}</span>
            <span className="text-slate-500 text-lg mx-1.5">/</span>
            <span className="text-sky-400">{latest.macd_signal ?? '-'}</span>
          </div>
          <p className="text-xs text-slate-400 leading-tight">
            {latest.macd_status || 'Momentum relatif stabil'}
          </p>
        </div>

        {/* SMA Card */}
        <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 hover:border-[#CCFF00]/40 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <TrendingUp className="w-4 h-4 text-[#CCFF00]" />
              SMA 20 / SMA 50
            </span>
            <span className="badge-stabilo px-2 py-0.5 rounded-full text-[11px] font-semibold">
              Trend
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-white mb-1">
            <span className="text-amber-400">
              {latest.sma_20 ? `Rp ${latest.sma_20.toLocaleString('id-ID')}` : '-'}
            </span>
            <span className="text-slate-500 text-base mx-1.5">/</span>
            <span className="text-indigo-400">
              {latest.sma_50 ? `Rp ${latest.sma_50.toLocaleString('id-ID')}` : '-'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-tight">
            {latest.sma_status || 'Posisi harga terhadap moving average'}
          </p>
        </div>
      </div>

      {/* RSI Chart */}
      <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#CCFF00]" />
              Grafik RSI (14)
            </span>
            <span className="text-slate-400 font-mono">
              Nilai: <strong className="text-[#CCFF00]">{activeInd.rsi_14 ?? '-'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span className="text-rose-400">70 Jenuh Beli</span>
            <span className="text-emerald-400">30 Jenuh Jual</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${rsiHeight}`} className="w-full h-44 select-none">
          {/* Overbought / Oversold zones */}
          <rect x="20" y={getRsiY(100)} width={svgWidth - 40} height={getRsiY(70) - getRsiY(100)} fill="rgba(244, 63, 94, 0.08)" />
          <rect x="20" y={getRsiY(30)} width={svgWidth - 40} height={getRsiY(0) - getRsiY(30)} fill="rgba(16, 185, 129, 0.08)" />

          {/* Reference lines */}
          <line x1="20" y1={getRsiY(70)} x2={svgWidth - 20} y2={getRsiY(70)} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="20" y1={getRsiY(50)} x2={svgWidth - 20} y2={getRsiY(50)} stroke="#334155" strokeDasharray="2 2" strokeWidth="1" />
          <line x1="20" y1={getRsiY(30)} x2={svgWidth - 20} y2={getRsiY(30)} stroke="#10b981" strokeDasharray="4 4" strokeWidth="1" />

          {/* RSI Line */}
          <polyline
            fill="none"
            stroke="#CCFF00"
            strokeWidth="2.5"
            points={rsiPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* MACD Chart */}
      <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#CCFF00]" />
              Grafik MACD & Signal
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[#CCFF00]">MACD: {activeInd.macd ?? '-'}</span>
              <span className="text-sky-400">Signal: {activeInd.macd_signal ?? '-'}</span>
            </div>
          </div>
          <span className="text-slate-400 text-xs font-mono">{activeInd.indicator_date}</span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${macdHeight}`} className="w-full h-44 select-none">
          {/* Zero center line */}
          <line x1="20" y1={getMacdY(0)} x2={svgWidth - 20} y2={getMacdY(0)} stroke="#475569" strokeWidth="1" />

          {/* Histogram bars */}
          {history.map((h, i) => {
            if (h.macd === null || h.macd_signal === null) return null;
            const diff = h.macd - h.macd_signal;
            const x = getX(i);
            const y0 = getMacdY(0);
            const yVal = getMacdY(diff);
            const barH = Math.abs(yVal - y0);
            const top = diff >= 0 ? yVal : y0;
            const color = diff >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)';

            return <rect key={i} x={x - 2} y={top} width="4" height={Math.max(1, barH)} fill={color} />;
          })}

          {/* MACD line */}
          <polyline
            fill="none"
            stroke="#CCFF00"
            strokeWidth="2.2"
            points={macdPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Signal line */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="3 3"
            points={signalPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
