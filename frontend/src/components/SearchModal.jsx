import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { INITIAL_STOCKS, STOCK_DATA } from '../api/mockData';

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = INITIAL_STOCKS.filter(
    (s) =>
      s.ticker.toLowerCase().includes(query.toLowerCase()) ||
      s.company_name.toLowerCase().includes(query.toLowerCase()) ||
      s.sector.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const handleSelect = (ticker) => {
    navigate(`/stocks/${ticker}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0c121e] border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#CCFF00]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik kode saham (cth: BBCA, TLKM) atau nama perusahaan..."
            className="w-full pl-12 pr-10 py-3.5 bg-[#080c14] border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Tidak ada saham ditemukan dengan kata kunci "{query}"
            </div>
          ) : (
            filtered.map((stock) => {
              const data = STOCK_DATA[stock.ticker] || STOCK_DATA['BBCA'] || {};
              const last = data.latestPrice || { close_price: 1000 };
              const prev = data.prevPrice || { close_price: 1000 };
              const changePct = prev.close_price > 0
                ? +(((last.close_price - prev.close_price) / prev.close_price) * 100).toFixed(2)
                : 0;
              const isUp = changePct >= 0;

              return (
                <div
                  key={stock.ticker}
                  onClick={() => handleSelect(stock.ticker)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/40 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold font-mono text-sm text-[#CCFF00] border border-slate-700 group-hover:border-[#CCFF00]/50 transition">
                      {stock.ticker}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-[#CCFF00] transition">
                        {stock.company_name}
                      </h4>
                      <span className="text-xs text-slate-400">{stock.sector}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-sm font-bold font-mono text-white">
                        Rp {last.close_price.toLocaleString('id-ID')}
                      </div>
                      <div
                        className={`text-xs font-semibold font-mono flex items-center justify-end gap-0.5 ${
                          isUp ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? `+${changePct}%` : `${changePct}%`}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#CCFF00] group-hover:translate-x-1 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
          <span>Pencarian Saham BEI / IDX</span>
          <span>Tekan ESC untuk menutup</span>
        </div>
      </div>
    </div>
  );
}
