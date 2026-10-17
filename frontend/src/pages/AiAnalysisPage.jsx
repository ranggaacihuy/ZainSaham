import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  FileText,
  BarChart2,
  Newspaper,
  Layers,
} from 'lucide-react';
import { aiApi } from '../api/aiApi';
import { stockApi } from '../api/stockApi';
import { INITIAL_STOCKS } from '../api/mockData';
import { useToast } from '../context/ToastContext';

export default function AiAnalysisPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const initialTicker = searchParams.get('ticker') || 'BBCA';
  const initialStock =
    INITIAL_STOCKS.find((s) => s.ticker === initialTicker.toUpperCase()) || INITIAL_STOCKS[0];

  const [selectedStockId, setSelectedStockId] = useState(initialStock.stock_id);
  const [analysisType, setAnalysisType] = useState('menyeluruh'); // 'teknikal' | 'fundamental' | 'sentimen' | 'menyeluruh'
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState('Siap melakukan analisis');
  const [currentSession, setCurrentSession] = useState(null);
  const [activeVersion, setActiveVersion] = useState(1);

  const types = [
    {
      id: 'menyeluruh',
      title: 'Menyeluruh (360°)',
      desc: 'Sintesis gabungan teknikal, fundamental, & sentimen berita',
      icon: Layers,
    },
    {
      id: 'teknikal',
      title: 'Teknikal',
      desc: 'Evaluasi 60 harga penutupan, RSI 14, MACD, & SMA',
      icon: BarChart2,
    },
    {
      id: 'fundamental',
      title: 'Fundamental',
      desc: 'Evaluasi 4 periode laporan keuangan, EPS, ROE, ROA, & DER',
      icon: TrendingUp,
    },
    {
      id: 'sentimen',
      title: 'Sentimen Berita',
      desc: 'Analisis sentimen dari 10 berita terkini & katalis emiten',
      icon: Newspaper,
    },
  ];

  // Pre-load default BBCA analysis session if available
  useEffect(() => {
    async function loadLatestSession() {
      try {
        const sessions = await aiApi.getSessions();
        const found = sessions.find((s) => s.ticker === initialStock.ticker);
        if (found) {
          setCurrentSession(found);
          setActiveVersion(found.analyses?.length || 1);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadLatestSession();
  }, [initialStock.ticker]);

  const handleStartAnalysis = async () => {
    const stockObj = INITIAL_STOCKS.find((s) => s.stock_id === Number(selectedStockId));
    if (!stockObj) return;

    setIsAnalyzing(true);
    setStatusText('Mengumpulkan data pasar, indikator & berita emiten...');

    // Multi-stage realistic feedback
    setTimeout(() => {
      setStatusText('Menjalankan AI Agent (Laravel AI SDK: gemini-1.5-pro)...');
    }, 900);

    setTimeout(async () => {
      try {
        const session = await aiApi.startAnalysis({
          stockId: stockObj.stock_id,
          ticker: stockObj.ticker,
          analysisType,
        });
        setCurrentSession(session);
        setActiveVersion(session.analyses?.length || 1);
        setStatusText('Selesai');
        addToast(`Analisis AI untuk ${stockObj.ticker} berhasil dibuat!`, 'success');
      } catch (err) {
        setStatusText('Analisis gagal');
        addToast('Gagal memproses analisis AI.', 'error');
      } finally {
        setIsAnalyzing(false);
      }
    }, 2000);
  };

  const handleRegenerate = async () => {
    if (!currentSession) return;
    setIsAnalyzing(true);
    setStatusText('Melakukan analisis ulang dengan model AI...');

    setTimeout(async () => {
      try {
        const updated = await aiApi.regenerateAnalysis(currentSession.session_id);
        setCurrentSession({ ...updated });
        setActiveVersion(updated.analyses?.length || 1);
        setStatusText('Selesai');
        addToast('Versi analisis baru berhasil dibuat!', 'success');
      } catch (err) {
        addToast('Gagal memperbarui analisis.', 'error');
      } finally {
        setIsAnalyzing(false);
      }
    }, 1800);
  };

  const selectedStockObj =
    INITIAL_STOCKS.find((s) => s.stock_id === Number(selectedStockId)) || INITIAL_STOCKS[0];

  const currentAnalysis =
    currentSession?.analyses?.find((a) => a.version === activeVersion) ||
    currentSession?.analyses?.[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-[#CCFF00]" />
            Analisis Saham Berbasis Artificial Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gunakan kekuatan Large Language Model (Laravel AI SDK) untuk merangkum kondisi teknikal, fundamental, dan sentimen saham IDX
          </p>
        </div>

        <button
          onClick={() => navigate('/analysis-history')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700"
        >
          Lihat Riwayat Analisis
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Left Control Panel: Form (DPPL 3.1.11.2) */}
        <div className="lg:col-span-5 bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-6 h-fit">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#CCFF00]" />
              Konfigurasi Analisis AI
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih emiten saham dan fokus cakupan analisis yang diinginkan
            </p>
          </div>

          {/* Stock Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Pilih Saham (BEI / IDX)
            </label>
            <select
              value={selectedStockId}
              onChange={(e) => setSelectedStockId(e.target.value)}
              className="w-full px-4 py-3 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-[#CCFF00] font-mono transition"
            >
              {INITIAL_STOCKS.map((s) => (
                <option key={s.stock_id} value={s.stock_id}>
                  {s.ticker} — {s.company_name} ({s.sector})
                </option>
              ))}
            </select>
          </div>

          {/* Analysis Type Radio Buttons (DPPL radioJenis) */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300">
              Jenis Analisis
            </label>
            <div className="space-y-2">
              {types.map((t) => {
                const Icon = t.icon;
                const isChecked = analysisType === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setAnalysisType(t.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer transition border ${
                      isChecked
                        ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-white shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                        : 'bg-[#080C14] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        isChecked ? 'border-[#CCFF00] bg-[#CCFF00]' : 'border-slate-600'
                      }`}
                    >
                      {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-[#080C14]" />}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-[#CCFF00]' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">{t.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {t.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Button (DPPL btnMulai) */}
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)] flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-[#080C14] border-t-transparent rounded-full animate-spin" />
                <span>Menganalisis...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Mulai Analisis dengan AI</span>
              </>
            )}
          </button>

          {/* Status pill (DPPL lblStatus) */}
          <div className="flex items-center justify-between text-xs font-mono p-3 bg-[#080C14] rounded-xl border border-slate-800 text-slate-400">
            <span>Status:</span>
            <span className="text-[#CCFF00] font-semibold flex items-center gap-1.5">
              {isAnalyzing && <div className="w-2 h-2 rounded-full bg-[#CCFF00] animate-ping" />}
              {statusText}
            </span>
          </div>
        </div>

        {/* Right Output Panel: AI Result Card (DPPL panelHasil) */}
        <div className="lg:col-span-7 bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between space-y-6">
          {!currentSession || !currentAnalysis ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
              <Bot className="w-16 h-16 text-slate-700 animate-bounce" />
              <div>
                <h3 className="text-base font-bold text-white">Belum Ada Hasil Analisis</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Pilih saham di panel sebelah kiri lalu tekan tombol "Mulai Analisis dengan AI" untuk mendapatkan sintesis menyeluruh.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Result Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-[#CCFF00] text-[#080C14] font-mono font-black text-sm">
                      {currentSession.ticker}
                    </span>
                    <span className="badge-stabilo px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase">
                      {currentSession.analysis_type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1.5">
                    Model: <span className="text-slate-300 font-semibold">{currentAnalysis.model_name}</span> • {currentAnalysis.created_at}
                  </div>
                </div>

                {/* Versions Selector if multiple versions exist */}
                {currentSession.analyses?.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-[#080C14] p-1 rounded-xl border border-slate-800 text-xs">
                    {currentSession.analyses.map((a) => (
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

              {/* 4 Structured Result Sections (DPPL 3.1.11.2) */}
              <div className="space-y-5">
                {/* 1. Ringkasan */}
                <div className="bg-[#080C14] p-5 rounded-2xl border border-slate-800/80 space-y-2">
                  <h3 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    1. Ringkasan Kondisi Saham
                  </h3>
                  <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-sans">
                    {currentAnalysis.result?.ringkasan}
                  </p>
                </div>

                {/* 2. Poin Positif */}
                <div className="bg-[#080C14] p-5 rounded-2xl border border-emerald-500/20 space-y-2.5">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    2. Poin Positif & Katalis Penguatan
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentAnalysis.result?.poin_positif?.map((p, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 3. Risiko yang Perlu Diperhatikan */}
                <div className="bg-[#080C14] p-5 rounded-2xl border border-rose-500/20 space-y-2.5">
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    3. Risiko yang Perlu Diperhatikan
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentAnalysis.result?.risiko?.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 4. Kesimpulan */}
                <div className="bg-[#080C14] p-5 rounded-2xl border border-slate-800/80 space-y-2">
                  <h3 className="text-xs font-bold text-[#CCFF00] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    4. Kesimpulan Analisis AI
                  </h3>
                  <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-sans">
                    {currentAnalysis.result?.kesimpulan}
                  </p>
                </div>
              </div>

              {/* Legal Disclaimer Notice (DPPL txtDisclaimer) */}
              <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-400">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Disclaimer:</strong> Analisis ini dihasilkan secara otomatis oleh Artificial Intelligence berdasarkan data historis yang tersedia sebagai bahan pertimbangan riset. ZainSaham tidak memberikan saran investasi, rekomendasi mutlak, atau jaminan target harga keuntungan.
                </p>
              </div>

              {/* Actions: Analisis Ulang (DPPL btnAnalisisUlang) */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  onClick={() => navigate(`/stocks/${currentSession.ticker}`)}
                  className="text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  ← Buka Grafik Saham {currentSession.ticker}
                </button>

                <button
                  onClick={handleRegenerate}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-[#CCFF00] border border-[#CCFF00]/30 transition disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Analisis Ulang (Buat Versi Baru)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
