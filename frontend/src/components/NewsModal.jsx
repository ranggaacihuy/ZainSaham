import React from 'react';
import { X, ExternalLink, Calendar, Newspaper } from 'lucide-react';

export default function NewsModal({ news, onClose }) {
  if (!news) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00]">
              <Newspaper className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs font-semibold text-[#CCFF00] uppercase tracking-wider">
                {news.source || 'Berita Pasar'}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                {news.published_at}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold text-white leading-snug">
          {news.title}
        </h2>

        {/* Content */}
        <div className="text-slate-300 text-sm md:text-base leading-relaxed space-y-4 pt-2 border-t border-slate-800/80">
          <p>{news.content}</p>
          <p className="text-xs text-slate-400 italic">
            Informasi dihimpun dari feed keterbukaan bursa dan media finansial resmi untuk keperluan analisis investasi mandiri.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            Tutup
          </button>

          {news.source_url && (
            <a
              href={news.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_15px_rgba(204,255,0,0.3)] transition"
            >
              <span>Baca di Sumber Asli</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
