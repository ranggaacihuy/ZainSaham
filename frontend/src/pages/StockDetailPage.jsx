import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  Sparkles,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  DollarSign,
  Newspaper,
  Calendar,
  Layers,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { stockApi } from '../api/stockApi';
import { useToast } from '../context/ToastContext';
import StockChart from '../components/StockChart';
import TechnicalChart from '../components/TechnicalChart';
import FundamentalChart from '../components/FundamentalChart';
import NewsModal from '../components/NewsModal';

export default function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'indicators' | 'fundamentals' | 'news'
  const [range, setRange] = useState('3B'); // '1B' | '3B' | '6B' | '1T' | '5T'
  const [fundamentalType, setFundamentalType] = useState('quarterly'); // 'quarterly' | 'annual'

  // Data states
  const [prices, setPrices] = useState([]);
  const [indicators, setIndicators] = useState({ history: [], latest: {} });
  const [fundamentals, setFundamentals] = useState([]);
  const [newsList, setNewsList] = useState([]);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsLimit, setNewsLimit] = useState(6);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    async function loadStockDetails() {
      if (!ticker) return;
      try {
        setLoading(true);
        const [stk, prc, ind, fund, nws, wList] = await Promise.all([
          stockApi.getStockDetail(ticker),
          stockApi.getStockPrices(ticker, range),
          stockApi.getStockIndicators(ticker, range),
          stockApi.getStockFundamentals(ticker, fundamentalType),
          stockApi.getStockNews(ticker),
          stockApi.getWatchlist(),
        ]);

        setStock(stk);
        setPrices(prc);
        setIndicators(ind);
        setFundamentals(fund);
        setNewsList(nws);
        setInWatchlist(wList.some((w) => w.ticker === ticker.toUpperCase()));
      } catch (err) {
        console.error(err);
        addToast(err.message || 'Gagal memuat detail saham', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadStockDetails();
  }, [ticker]);

  // Reload prices & indicators when range changes
  useEffect(() => {
    if (!ticker) return;
    stockApi.getStockPrices(ticker, range).then(setPrices);
    stockApi.getStockIndicators(ticker, range).then(setIndicators);
  }, [range, ticker]);

  // Reload fundamentals when type changes
  useEffect(() => {
    if (!ticker) return;
    stockApi.getStockFundamentals(ticker, fundamentalType).then(setFundamentals);
  }, [fundamentalType, ticker]);

  // Watchlist toggle handler
  const handleToggleWatchlist = async () => {
    if (!stock) return;
    try {
      setWatchlistLoading(true);
      if (inWatchlist) {
        await stockApi.removeFromWatchlist(stock.ticker);
        setInWatchlist(false);
        addToast(`${stock.ticker} dihapus dari watchlist`, 'info');
      } else {
        await stockApi.addToWatchlist(stock.stock_id, stock.ticker);
        setInWatchlist(true);
        addToast(`${stock.ticker} ditambahkan ke watchlist`, 'success');
      }
    } catch (err) {
      addToast(err.message || 'Gagal mengubah watchlist', 'error');
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-8 h-8 border-3 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-400">Memuat data analisis {ticker}...</p>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Saham tidak ditemukan</h2>
        <p className="text-xs text-slate-400">Emiten dengan kode {ticker} belum terdaftar di sistem.</p>
        <button
          onClick={() => navigate('/stocks')}
          className="px-4 py-2 bg-[#CCFF00] text-[#080C14] rounded-xl text-xs font-bold"
        >
          Kembali ke Daftar Saham
        </button>
      </div>
    );
  }

  const isUp = stock.change_pct >= 0;

  const tabs = [
    { id: 'chart', label: 'Grafik Harga', icon: BarChart3 },
    { id: 'indicators', label: 'Indikator Teknikal', icon: Activity },
    { id: 'fundamentals', label: 'Fundamental', icon: DollarSign },
    { id: 'news', label: 'Berita', icon: Newspaper },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* News Modal */}
      <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />

      {/* Back Button & Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            addToast('Tautan saham berhasil disalin ke clipboard!', 'success');
          }}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
          title="Salin tautan emiten"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Stock Main Header Banner (DPPL P005 lblInfoSaham, lblHarga) */}
      <div className="bg-[#0C121E] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* Left Info: Ticker, Name, Sector */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1.5 rounded-2xl bg-[#CCFF00] text-[#080C14] font-black font-mono text-xl shadow-[0_0_20px_rgba(204,255,0,0.35)]">
                {stock.ticker}
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-white">
                  {stock.company_name}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                  <span className="text-[#CCFF00] font-medium">{stock.sector}</span>
                  <span>•</span>
                  <span>Bursa: {stock.exchange}</span>
                  <span>•</span>
                  <span>Mata Uang: {stock.currency}</span>
                  <span>•</span>
                  <span>Data per: {stock.price_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Info: Price, % Change, High/Low, Volume & Actions */}
          <div className="flex flex-col md:items-end gap-4">
            <div className="md:text-right">
              <div className="text-3xl md:text-4xl font-black font-mono text-white tracking-tight">
                Rp {stock.close_price?.toLocaleString('id-ID')}
              </div>
              <div
                className={`flex items-center md:justify-end gap-1.5 text-sm font-bold font-mono mt-1 ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>
                  {isUp ? `+Rp ${stock.change_value?.toLocaleString('id-ID')}` : `-Rp ${Math.abs(stock.change_value)?.toLocaleString('id-ID')}`}
                </span>
                <span>({isUp ? `+${stock.change_pct}%` : `${stock.change_pct}%`})</span>
              </div>
            </div>

            {/* Action buttons (btnWatchlist & btnAnalisisAI) */}
            <div className="flex items-center gap-3">
              <button
                disabled={watchlistLoading}
                onClick={handleToggleWatchlist}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                  inWatchlist
                    ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40 shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'bg-slate-800 text-slate-200 hover:text-[#CCFF00] hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {inWatchlist ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-[#CCFF00]" />
                    <span>Hapus dari Watchlist</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>+ Tambah ke Watchlist</span>
                  </>
                )}
              </button>

              <button
                onClick={() =>
                  navigate(`/ai-analysis?ticker=${stock.ticker}&id=${stock.stock_id}`)
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)] transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analisis dengan AI</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mini stats ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs font-mono">
          <div className="bg-[#080C14]/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Harga Pembukaan</span>
            <span className="font-bold text-white text-sm">
              Rp {stock.open_price?.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="bg-[#080C14]/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Tertinggi (High)</span>
            <span className="font-bold text-emerald-400 text-sm">
              Rp {stock.high_price?.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="bg-[#080C14]/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Terendah (Low)</span>
            <span className="font-bold text-rose-400 text-sm">
              Rp {stock.low_price?.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="bg-[#080C14]/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Volume Perdagangan</span>
            <span className="font-bold text-[#CCFF00] text-sm">
              {(stock.volume / 1000000).toFixed(2)} Juta Lembar
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation (DPPL tabMenu) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#CCFF00] text-[#080C14] shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Grafik Harga (P005) */}
      {activeTab === 'chart' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <StockChart
            prices={prices}
            currentRange={range}
            onRangeChange={setRange}
            ticker={stock.ticker}
          />
        </div>
      )}

      {/* Tab 2: Indikator Teknikal (P006) */}
      {activeTab === 'indicators' && (
        <div className="animate-in fade-in duration-200">
          <TechnicalChart indicators={indicators} ticker={stock.ticker} />
        </div>
      )}

      {/* Tab 3: Fundamental (P007) */}
      {activeTab === 'fundamentals' && (
        <div className="animate-in fade-in duration-200">
          <FundamentalChart
            fundamentals={fundamentals}
            periodType={fundamentalType}
            onTypeChange={setFundamentalType}
            ticker={stock.ticker}
          />
        </div>
      )}

      {/* Tab 4: Berita Saham (P008) */}
      {activeTab === 'news' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newsList.slice(0, newsLimit).map((item) => (
              <div
                key={item.news_id}
                onClick={() => setSelectedNews(item)}
                className="bg-[#0C121E] border border-slate-800/90 hover:border-[#CCFF00]/40 p-5 rounded-2xl cursor-pointer transition shadow-xl space-y-3 group"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="badge-stabilo px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
                    {item.source}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {item.published_at?.slice(0, 16)}
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm group-hover:text-[#CCFF00] transition line-clamp-2 leading-snug">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {item.content}
                </p>

                <div className="pt-2 flex items-center justify-between text-xs text-[#CCFF00] font-semibold">
                  <span>Baca Rincian</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>

          {newsLimit < newsList.length && (
            <div className="text-center pt-4">
              <button
                onClick={() => setNewsLimit(newsLimit + 6)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-bold transition"
              >
                Muat Lebih Banyak Berita
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
