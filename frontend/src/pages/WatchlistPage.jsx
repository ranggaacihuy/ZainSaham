import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Gauge,
  Calendar,
} from 'lucide-react';
import { stockApi } from '../api/stockApi';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, ticker }
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const data = await stockApi.getWatchlist();
      setWatchlist(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setWatchlist([]);
      addToast('Gagal memuat watchlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await stockApi.removeFromWatchlist(deleteTarget.ticker);
      setWatchlist((prev) => prev.filter((item) => item.ticker !== deleteTarget.ticker));
      addToast(`${deleteTarget.ticker} berhasil dihapus dari watchlist.`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      addToast('Gagal menghapus saham dari watchlist.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Delete Confirmation Modal (DPPL dialogKonfirmasi) */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title={`Hapus ${deleteTarget?.ticker} dari Watchlist?`}
        message={`Saham ${deleteTarget?.ticker} (${deleteTarget?.company_name}) akan dihapus dari daftar pantauan Anda. Anda selalu dapat menambahkannya kembali kapan saja.`}
        confirmText="Ya, Hapus"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0C121E] border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-2xl text-[#CCFF00]">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Daftar Pantauan (Watchlist)</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pantau harga, pergerakan harian, dan indikator teknikal saham pilihan Anda
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/stocks')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)] transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Saham</span>
        </button>
      </div>

      {/* Watchlist Table */}
      <div className="bg-[#0C121E] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Memuat watchlist...</span>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <Bookmark className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Watchlist Anda masih kosong</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Simpan saham-saham favorit Anda dari halaman Daftar Saham untuk memantau pergerakan harga dan analisis teknikal secara terpusat.
            </p>
            <button
              onClick={() => navigate('/stocks')}
              className="px-5 py-2.5 bg-[#CCFF00] text-[#080C14] rounded-xl text-xs font-bold hover:bg-[#b8e600] shadow-[0_0_15px_rgba(204,255,0,0.25)] transition"
            >
              Jelajahi Saham BEI Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080C14] text-slate-400 font-mono uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5">Kode</th>
                  <th className="py-3.5 px-5">Perusahaan</th>
                  <th className="py-3.5 px-5 text-right">Harga Terakhir</th>
                  <th className="py-3.5 px-5 text-right">Perubahan (%)</th>
                  <th className="py-3.5 px-5 text-center">RSI (14)</th>
                  <th className="py-3.5 px-5 text-center">Ditambahkan Pada</th>
                  <th className="py-3.5 px-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {watchlist.map((item) => {
                  const isUp = item.change_pct >= 0;
                  return (
                    <tr
                      key={item.watchlist_id}
                      onClick={() => navigate(`/stocks/${item.ticker}`)}
                      className="hover:bg-slate-800/30 cursor-pointer transition group"
                    >
                      <td className="py-4 px-5 font-bold font-mono text-[#CCFF00] text-sm">
                        {item.ticker}
                      </td>
                      <td className="py-4 px-5 font-semibold text-white">
                        {item.company_name}
                      </td>
                      <td className="py-4 px-5 font-mono font-bold text-white text-right">
                        Rp {item.close_price.toLocaleString('id-ID')}
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
                          {isUp ? `+${item.change_pct}%` : `${item.change_pct}%`}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-mono">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            item.rsi_14 >= 70
                              ? 'text-rose-400 bg-rose-500/15'
                              : item.rsi_14 <= 30
                              ? 'text-emerald-400 bg-emerald-500/15'
                              : 'text-[#CCFF00] bg-[#CCFF00]/10'
                          }`}
                        >
                          {item.rsi_14}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center text-slate-400 font-mono text-[11px]">
                        {item.created_at?.slice(0, 10)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/stocks/${item.ticker}`);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-[#CCFF00] rounded-xl text-xs font-semibold transition"
                          >
                            Detail
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(item);
                            }}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition"
                            title="Hapus dari watchlist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
