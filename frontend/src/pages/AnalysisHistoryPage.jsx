import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  Trash2,
  Eye,
  Bot,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { aiApi } from '../api/aiApi';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

export default function AnalysisHistoryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('Semua');
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeVersion, setActiveVersion] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await aiApi.getSessions({
        ticker: tickerFilter,
        type: typeFilter,
      });
      setSessions(data);

      const targetId = searchParams.get('session');
      if (targetId) {
        const found = data.find((s) => s.session_id === Number(targetId));
        if (found) {
          setSelectedSession(found);
          setActiveVersion(found.analyses?.length || 1);
        }
      } else if (!selectedSession && data.length > 0) {
        setSelectedSession(data[0]);
        setActiveVersion(data[0].analyses?.length || 1);
      }
    } catch (err) {
      console.error(err);
      addToast('Gagal memuat riwayat analisis AI', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [tickerFilter, typeFilter]);

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    setActiveVersion(session.analyses?.length || 1);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await aiApi.deleteSession(deleteTarget.session_id);
      setSessions((prev) => prev.filter((s) => s.session_id !== deleteTarget.session_id));
      if (selectedSession?.session_id === deleteTarget.session_id) {
        setSelectedSession(null);
      }
      addToast('Sesi analisis berhasil dihapus.', 'info');
      setDeleteTarget(null);
    } catch (err) {
      addToast('Gagal menghapus sesi analisis.', 'error');
    }
  };

  const currentAnalysis =
    selectedSession?.analyses?.find((a) => a.version === activeVersion) ||
    selectedSession?.analyses?.[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title={`Hapus Sesi Analisis ${deleteTarget?.ticker}?`}
        message={`Sesi analisis tanggal ${deleteTarget?.created_at} beserta seluruh riwayat versi hasil analisisnya akan dihapus permanen.`}
        confirmText="Ya, Hapus Sesi"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0C121E] border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-2xl text-[#CCFF00]">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Riwayat Analisis AI</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Daftar seluruh dokumen dan sesi riset AI yang pernah Anda generate sebelumnya
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/ai-analysis')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.3)] transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>+ Buat Analisis Baru</span>
        </button>
      </div>

      {/* Filter Bars (DPPL inputFilterKode & selectFilterJenis) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0C121E] border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CCFF00]" />
          <input
            type="text"
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            placeholder="Filter berdasarkan kode saham (cth: BBCA)..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00] transition font-mono uppercase"
          />
        </div>

        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-[#CCFF00] transition"
          >
            <option value="Semua">Semua Jenis Analisis</option>
            <option value="teknikal">Teknikal</option>
            <option value="fundamental">Fundamental</option>
            <option value="sentimen">Sentimen Berita</option>
            <option value="menyeluruh">Menyeluruh</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Sessions List (Left) and Session Detail Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sessions Table (Left 5 cols) */}
        <div className="lg:col-span-5 bg-[#0C121E] border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Daftar Sesi ({sessions.length})</span>
            <span className="text-slate-500 font-mono">Terbaru</span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <div className="w-5 h-5 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Memuat riwayat...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs px-4">
                Belum ada riwayat analisis AI yang cocok dengan filter.
              </div>
            ) : (
              sessions.map((item) => {
                const isSelected = selectedSession?.session_id === item.session_id;
                return (
                  <div
                    key={item.session_id}
                    onClick={() => handleSelectSession(item)}
                    className={`p-4 cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#CCFF00]/10 border-l-4 border-[#CCFF00]'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                          {item.ticker}
                        </span>
                        <span className="badge-stabilo px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                          {item.analysis_type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({item.analyses?.length || 1} Versi)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {item.created_at}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSession(item);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#CCFF00] rounded-lg transition"
                        title="Lihat rincian"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item);
                        }}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                        title="Hapus sesi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Session Details Panel (Right 7 cols - DPPL panelDetailSesi) */}
        <div className="lg:col-span-7 bg-[#0C121E] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {!selectedSession || !currentAnalysis ? (
            <div className="py-24 text-center text-slate-500 space-y-2">
              <Bot className="w-12 h-12 mx-auto text-slate-700" />
              <p className="text-xs">Pilih salah satu sesi di sebelah kiri untuk melihat rincian laporan AI.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-mono text-[#CCFF00]">
                      {selectedSession.ticker}
                    </span>
                    <span className="badge-stabilo px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase">
                      {selectedSession.analysis_type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Model: {currentAnalysis.model_name} • Dibuat: {currentAnalysis.created_at}
                  </div>
                </div>

                {/* Version switcher */}
                {selectedSession.analyses?.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-[#080C14] p-1 rounded-xl border border-slate-800 text-xs">
                    {selectedSession.analyses.map((a) => (
                      <button
                        key={a.ai_analysis_id || a.version}
                        onClick={() => setActiveVersion(a.version)}
                        className={`px-3 py-1 rounded-lg font-mono font-bold transition ${
                          activeVersion === a.version
                            ? 'bg-[#CCFF00] text-[#080C14]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Versi {a.version}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4 Sections */}
              <div className="space-y-4">
                <div className="bg-[#080C14] p-4 md:p-5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Ringkasan
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {currentAnalysis.result?.ringkasan}
                  </p>
                </div>

                <div className="bg-[#080C14] p-4 md:p-5 rounded-2xl border border-emerald-500/20 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Poin Positif
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {currentAnalysis.result?.poin_positif?.map((p, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#080C14] p-4 md:p-5 rounded-2xl border border-rose-500/20 space-y-2">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Risiko yang Perlu Diperhatikan
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {currentAnalysis.result?.risiko?.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#080C14] p-4 md:p-5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Kesimpulan
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {currentAnalysis.result?.kesimpulan}
                  </p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Analisis AI ini murni alat bantu riset, bukan rekomendasi investasi mutlak.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
