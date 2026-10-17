import React, { useState } from 'react';
import { DollarSign, BarChart2, ChevronDown, ChevronUp, Layers } from 'lucide-react';

export default function FundamentalChart({
  fundamentals = [],
  periodType = 'quarterly',
  onTypeChange,
  ticker = '',
}) {
  const [expandedPeriod, setExpandedPeriod] = useState(null);

  if (!fundamentals || fundamentals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-[#0c121e] rounded-2xl border border-slate-800 text-slate-400">
        <DollarSign className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
        <p className="font-medium text-slate-300">Data fundamental belum tersedia untuk saham ini</p>
      </div>
    );
  }

  // Format large Rupiah values
  const formatTrillion = (val) => {
    if (!val) return 'Rp 0';
    if (val >= 1e12) {
      return `Rp ${(val / 1e12).toFixed(2)} T`;
    }
    if (val >= 1e9) {
      return `Rp ${(val / 1e9).toFixed(2)} M`;
    }
    return `Rp ${Number(val).toLocaleString('id-ID')}`;
  };

  // Chart geometry
  const chartHeight = 200;
  const svgWidth = 840;
  const count = fundamentals.length;

  let maxVal = 0;
  fundamentals.forEach((f) => {
    if (f.revenue > maxVal) maxVal = f.revenue;
    if (f.net_income > maxVal) maxVal = f.net_income;
  });
  maxVal = maxVal * 1.15 || 1000;

  const getBarX = (idx) => {
    const slot = (svgWidth - 60) / count;
    return 30 + idx * slot;
  };

  const getH = (val) => {
    if (!val || val <= 0) return 0;
    return (val / maxVal) * (chartHeight - 40);
  };

  return (
    <div className="space-y-6">
      {/* Period Toggle & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0c121e] p-4 rounded-2xl border border-slate-800/80">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#CCFF00]" />
            Laporan Kinerja Keuangan ({ticker})
          </h3>
          <p className="text-xs text-slate-400">
            Perbandingan tren pendapatan (revenue) terhadap laba bersih (net income)
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#080c14] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onTypeChange?.('quarterly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              periodType === 'quarterly'
                ? 'bg-[#CCFF00] text-[#080C14] shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Kuartalan
          </button>
          <button
            onClick={() => onTypeChange?.('annual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              periodType === 'annual'
                ? 'bg-[#CCFF00] text-[#080C14] shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tahunan
          </button>
        </div>
      </div>

      {/* Bar Chart: Revenue vs Net Income */}
      <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 p-5 shadow-xl">
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="font-semibold text-white">Grafik Pendapatan vs Laba Bersih</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-[#CCFF00]" />
              Pendapatan
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              Laba Bersih
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${chartHeight}`} className="w-full h-48 select-none">
          {/* Base baseline */}
          <line x1="20" y1={chartHeight - 25} x2={svgWidth - 20} y2={chartHeight - 25} stroke="#334155" />

          {fundamentals.map((f, i) => {
            const x = getBarX(i);
            const slotWidth = (svgWidth - 60) / count;
            const barW = Math.min(28, slotWidth * 0.35);
            const revH = getH(f.revenue);
            const netH = getH(f.net_income);
            const baseY = chartHeight - 25;

            return (
              <g key={f.period || i}>
                {/* Revenue Bar */}
                <rect
                  x={x + slotWidth / 2 - barW - 2}
                  y={baseY - revH}
                  width={barW}
                  height={revH}
                  fill="#CCFF00"
                  rx="2"
                  className="transition-all hover:opacity-90"
                />
                {/* Net Income Bar */}
                <rect
                  x={x + slotWidth / 2 + 2}
                  y={baseY - netH}
                  width={barW}
                  height={netH}
                  fill="#10B981"
                  rx="2"
                  className="transition-all hover:opacity-90"
                />
                {/* Period Label */}
                <text
                  x={x + slotWidth / 2}
                  y={chartHeight - 8}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {f.period}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Financial Ratios & Breakdown Table */}
      <div className="bg-[#0c121e] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="font-bold text-sm text-white">Ringkasan Laporan Keuangan & Rasio</h4>
          <span className="text-xs text-slate-400">Klik baris untuk rincian Aset, Liabilitas & Ekuitas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080c14] text-slate-400 font-mono uppercase border-b border-slate-800/60">
              <tr>
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Pendapatan</th>
                <th className="py-3 px-4">Laba Bersih</th>
                <th className="py-3 px-4">EPS</th>
                <th className="py-3 px-4">ROE (%)</th>
                <th className="py-3 px-4">ROA (%)</th>
                <th className="py-3 px-4">DER</th>
                <th className="py-3 px-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {fundamentals.map((f) => {
                const isExpanded = expandedPeriod === f.period;
                return (
                  <React.Fragment key={f.period}>
                    <tr
                      onClick={() => setExpandedPeriod(isExpanded ? null : f.period)}
                      className="hover:bg-slate-800/30 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-bold text-white font-mono">{f.period}</td>
                      <td className="py-3.5 px-4 font-mono text-[#CCFF00] font-semibold">{formatTrillion(f.revenue)}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400 font-semibold">{formatTrillion(f.net_income)}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">Rp {f.eps ?? '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-sky-300">{f.roe ? `${f.roe}%` : '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300">{f.roa ? `${f.roa}%` : '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-amber-300">{f.debt_to_equity ? `${f.debt_to_equity}x` : '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button className="text-slate-400 hover:text-white p-1">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#CCFF00]" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Balance Sheet Details */}
                    {isExpanded && (
                      <tr className="bg-[#080c14]/80">
                        <td colSpan={8} className="py-4 px-6 border-l-2 border-[#CCFF00]">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="bg-[#0f1724] p-3 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block mb-1">Total Aset</span>
                              <span className="text-white font-bold font-mono text-sm">
                                {formatTrillion(f.total_assets)}
                              </span>
                            </div>
                            <div className="bg-[#0f1724] p-3 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block mb-1">Total Liabilitas (Utang)</span>
                              <span className="text-rose-400 font-bold font-mono text-sm">
                                {formatTrillion(f.total_liabilities)}
                              </span>
                            </div>
                            <div className="bg-[#0f1724] p-3 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block mb-1">Total Ekuitas (Modal)</span>
                              <span className="text-[#CCFF00] font-bold font-mono text-sm">
                                {formatTrillion(f.total_equity)}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
