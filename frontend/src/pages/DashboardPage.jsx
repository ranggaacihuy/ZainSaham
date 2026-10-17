import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Newspaper,
  Bookmark,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { stockApi } from '../api/stockApi';
import { aiApi } from '../api/aiApi';
import NewsModal from '../components/NewsModal';

// Mini sparkline component
function Sparkline({ data = [], isUp = true }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 70;
  const h = 24;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor = isUp ? '#10B981' : '#F43F5E';

  return (
    <svg width={w} height={h} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [aiSessions, setAiSessions] = useState([]);
  const [selectedNews, setSelectedNews] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [dash, sessions] = await Promise.all([
        stockApi.getDashboard(),
        aiApi.getSessions(),
      ]);
      setDashboardData(dash);
      setAiSessions(sessions ? sessions.slice(0, 3) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-7 animate-in fade-in duration-300">
      {/* News Modal */}
      <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />

      {/* Top Banner / Welcome header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#0C121E] via-[#0E1524] to-[#121B2C] border border-slate-800 p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[#CCFF00]/5 blur-3xl pointer-events-none" />
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#CCFF00] uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-ping" />
            Terminal Riset Pasar Saham Indonesia
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Ringkasan Pasar & Portofolio Pantauan
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data bursa terakhir: <span className="font-mono text-slate-300">{dashboardData?.last_market_date || 'Hari Ini'}</span> • Dukungan analisis prediktif AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition border border-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={() => navigate('/ai-analysis')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)] transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Analisis Baru</span>
          </button>
        </div>
      </div>

      {/* Grid: Watchlist Saya (Primary Focus) */}
      <div className="bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00]">
              <Bookmark className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Watchlist Saya</h2>
              <p className="text-xs text-slate-400">Saham yang sedang aktif Anda pantau</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/watchlist')}
            className="text-xs font-semibold text-[#CCFF00] hover:underline flex items-center gap-1"
          >
            <span>Kelola Watchlist</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Watchlist Table */}
        {!dashboardData?.watchlist || dashboardData.watchlist.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-[#080C14]/50 rounded-2xl border border-slate-800/60">
            <p className="text-xs text-slate-400">Watchlist kamu masih kosong.</p>
            <button
              onClick={() => navigate('/stocks')}
              className="px-4 py-2 bg-[#CCFF00] text-[#080C14] rounded-xl text-xs font-bold hover:bg-[#b8e600] transition"
            >
              Cari Saham Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080C14] text-slate-400 font-mono uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Perusahaan</th>
                  <th className="py-3 px-4 text-right">Harga Terakhir</th>
                  <th className="py-3 px-4 text-right">Perubahan</th>
                  <th className="py-3 px-4 text-center">Tren 1 Bulan</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {dashboardData.watchlist.map((item) => {
                  const isUp = item.change_pct >= 0;
                  return (
                    <tr
                      key={item.watchlist_id}
                      onClick={() => navigate(`/stocks/${item.ticker}`)}
                      className="hover:bg-slate-800/40 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-bold font-mono text-[#CCFF00] text-sm">
                        {item.ticker}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                        {item.company_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-right">
                        Rp {item.close_price?.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] ${
                            isUp
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}
                        >
                          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isUp ? `+${item.change_pct}%` : `${item.change_pct}%`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Sparkline data={item.sparkline} isUp={isUp} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/stocks/${item.ticker}`);
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-[#CCFF00] rounded-lg text-xs font-semibold transition"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grid: Top Gainers & Top Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Gainers (DPPL tblTopGainers) */}
        <div className="bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm text-white">Top Gainers (Hari Bursa Terakhir)</h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">Kenaikan Terbesar</span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {dashboardData?.top_gainers?.map((stock) => (
              <div
                key={stock.ticker}
                onClick={() => navigate(`/stocks/${stock.ticker}`)}
                className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-xl cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-12 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-[#CCFF00]">
                    {stock.ticker}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-white block">{stock.company_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Rp {stock.close_price.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  +{stock.change_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers (DPPL tblTopLosers) */}
        <div className="bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm text-white">Top Losers (Hari Bursa Terakhir)</h3>
            </div>
            <span className="text-[11px] font-mono text-rose-400">Penurunan Terendah</span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {dashboardData?.top_losers?.map((stock) => (
              <div
                key={stock.ticker}
                onClick={() => navigate(`/stocks/${stock.ticker}`)}
                className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-xl cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-12 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                    {stock.ticker}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-white block">{stock.company_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Rp {stock.close_price.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <span className="font-mono font-bold text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                  {stock.change_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Berita Terbaru & Analisis AI Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Berita Terbaru dari Watchlist (DPPL listBerita) */}
        <div className="bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00]">
                <Newspaper className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm text-white">Berita Terbaru dari Watchlist</h3>
            </div>
            <span className="text-xs text-slate-400">5 Berita Terkini</span>
          </div>

          <div className="space-y-3">
            {dashboardData?.latest_news?.map((news) => (
              <div
                key={news.news_id}
                onClick={() => setSelectedNews(news)}
                className="p-3.5 bg-[#080C14] hover:bg-slate-800/40 border border-slate-800/70 rounded-2xl cursor-pointer transition group space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#CCFF00] font-mono font-bold">{news.ticker}</span>
                  <span className="text-slate-400">{news.source} • {news.published_at?.slice(0, 10)}</span>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#CCFF00] transition line-clamp-2">
                  {news.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {news.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Analisis AI Terakhir (DPPL listAnalisis & btnAnalisisBaru) */}
        <div className="bg-[#0C121E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00]">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm text-white">Analisis AI Terakhir</h3>
              </div>
              <button
                onClick={() => navigate('/analysis-history')}
                className="text-xs font-semibold text-[#CCFF00] hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            <div className="space-y-3">
              {aiSessions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada sesi analisis AI yang dijalankan.
                </div>
              ) : (
                aiSessions.map((session) => (
                  <div
                    key={session.session_id}
                    onClick={() => navigate(`/analysis-history?session=${session.session_id}`)}
                    className="p-3.5 bg-[#080C14] hover:bg-slate-800/40 border border-slate-800/70 rounded-2xl cursor-pointer transition group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                          {session.ticker}
                        </span>
                        <span className="badge-stabilo px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                          {session.analysis_type}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {session.created_at}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {session.analyses?.[0]?.result?.ringkasan ||
                        'Analisis menyeluruh mencakup tren teknikal, kesehatan fundamental, dan momentum pasar.'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => navigate('/ai-analysis')}
              className="w-full py-3 rounded-2xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.3)] flex items-center justify-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Analisis Saham Baru dengan AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
