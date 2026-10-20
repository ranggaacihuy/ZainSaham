import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { stockApi } from '../api/stockApi';

const SECTOR_OPTIONS = [
  'Semua',
  'Keuangan',
  'Material Dasar',
  'Infrastruktur',
  'Perindustrian',
  'Teknologi',
  'Konsumer Primer',
  'Energi',
  'Kesehatan',
];

export default function StockListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [sector, setSector] = useState('Semua');
  const [page, setPage] = useState(1);
  const [stockResult, setStockResult] = useState({
    items: [],
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Debounced search (DPPL 400ms debounce)
  useEffect(() => {
    const handler = setTimeout(() => {
      loadStocks();
    }, 400);

    return () => clearTimeout(handler);
  }, [keyword, sector, page]);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const res = await stockApi.getStocks({
        q: keyword,
        sector: sector === 'Semua' ? '' : sector,
        page,
        limit: 12,
      });

      if (res && Array.isArray(res.items)) {
        setStockResult(res);
      } else if (Array.isArray(res)) {
        setStockResult({
          items: res,
          total: res.length,
          totalPages: 1,
        });
      } else {
        setStockResult({
          items: [],
          total: 0,
          totalPages: 1,
        });
      }
    } catch (err) {
      console.error(err);
      setStockResult({
        items: [],
        total: 0,
        totalPages: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSectorChange = (e) => {
    setSector(e.target.value);
    setPage(1);
  };

  const handleKeywordChange = (e) => {
    setKeyword(e.target.value);
    setPage(1);
  };

  const stockItems = Array.isArray(stockResult?.items) ? stockResult.items : [];
  const totalCount = stockResult?.total ?? stockItems.length;
  const totalPages = Math.max(1, stockResult?.totalPages || 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-7 h-7 text-[#CCFF00]" />
            Daftar Saham Terdaftar (BEI)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Telusuri emiten di Bursa Efek Indonesia lengkap dengan sektor, harga, dan pergerakan harian
          </p>
        </div>
        <div className="badge-stabilo px-3 py-1 rounded-xl text-xs font-mono font-semibold">
          Total: {totalCount} Saham
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0C121E] border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CCFF00]" />
          <input
            type="text"
            value={keyword}
            onChange={handleKeywordChange}
            placeholder="Cari kode saham (cth: BBCA, TLKM) atau nama perusahaan..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition"
          />
        </div>

        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={sector}
            onChange={handleSectorChange}
            className="w-full px-3 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] transition"
          >
            {SECTOR_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                Sektor: {sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="bg-[#0C121E] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080C14] text-slate-400 font-mono uppercase border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-5">Kode Saham</th>
                <th className="py-3.5 px-5">Nama Perusahaan</th>
                <th className="py-3.5 px-5">Sektor</th>
                <th className="py-3.5 px-5 text-center">Bursa</th>
                <th className="py-3.5 px-5 text-right">Harga Terakhir</th>
                <th className="py-3.5 px-5 text-right">Perubahan (%)</th>
                <th className="py-3.5 px-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data saham...</span>
                    </div>
                  </td>
                </tr>
              ) : stockItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Saham dengan kata kunci tersebut tidak ditemukan.
                  </td>
                </tr>
              ) : (
                stockItems.map((stock) => {
                  const changePct = typeof stock.change_pct === 'number' ? stock.change_pct : 0;
                  const isUp = changePct >= 0;
                  const formattedPrice = typeof stock.close_price === 'number'
                    ? stock.close_price.toLocaleString('id-ID')
                    : '-';

                  return (
                    <tr
                      key={stock.ticker}
                      onClick={() => navigate(`/stocks/${stock.ticker}`)}
                      className="hover:bg-slate-800/30 cursor-pointer transition group"
                    >
                      <td className="py-4 px-5 font-bold font-mono text-[#CCFF00] text-sm group-hover:scale-105 transition-transform inline-block">
                        {stock.ticker}
                      </td>
                      <td className="py-4 px-5 font-semibold text-white">
                        {stock.company_name}
                      </td>
                      <td className="py-4 px-5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300">
                          {stock.sector}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-mono text-slate-400">
                        {stock.exchange || 'IDX'}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-white">
                        Rp {formattedPrice}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-semibold">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] ${
                            isUp
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}
                        >
                          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isUp ? `+${changePct}%` : `${changePct}%`}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/stocks/${stock.ticker}`);
                          }}
                          className="px-3.5 py-1.5 bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] rounded-xl text-xs font-bold shadow-[0_0_12px_rgba(204,255,0,0.25)] transition flex items-center gap-1 mx-auto"
                        >
                          <span>Detail</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (DPPL Table 3.15) */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#080C14] border-t border-slate-800 text-xs">
          <span className="text-slate-400 font-mono">
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition font-mono ${
                    page === pNum
                      ? 'bg-[#CCFF00] text-[#080C14] shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {pNum}
                </button>
              ))}
            </div>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
