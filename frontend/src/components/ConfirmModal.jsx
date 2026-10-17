import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = false,
  onConfirm,
  onClose,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0c121e] border border-slate-800 rounded-3xl p-6 md:p-7 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`p-2 rounded-xl border ${
                isDanger
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-[#CCFF00]/10 border-[#CCFF00]/30 text-[#CCFF00]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed">{message}</p>

        {children}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
              isDanger
                ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : 'bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_15px_rgba(204,255,0,0.3)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
