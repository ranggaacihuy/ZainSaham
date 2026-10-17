import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Save,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

export default function ProfilePage() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Soft delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (newPassword && !currentPassword) {
      addToast('Password lama wajib diisi bila ingin mengubah password.', 'error');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      addToast('Password baru minimal 8 karakter.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        username,
        email,
        current_password: currentPassword,
        password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      // handled in context
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteConfirmPassword) {
      addToast('Harap masukkan password Anda untuk konfirmasi.', 'error');
      return;
    }
    try {
      setIsDeleting(true);
      await deleteAccount(deleteConfirmPassword);
      setIsDeleteModalOpen(false);
      navigate('/login');
    } catch (err) {
      // handled
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Delete Account Modal (DPPL btnHapusAkun) */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Hapus Akun Pengguna"
        message="Akun akan dinonaktifkan (soft delete) dan Anda tidak akan bisa masuk lagi dengan email ini. Masukkan password untuk mengonfirmasi:"
        confirmText="Hapus Akun Sekarang"
        isDanger={true}
        onConfirm={handleConfirmDeleteAccount}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <div className="pt-2">
          <input
            type="password"
            value={deleteConfirmPassword}
            onChange={(e) => setDeleteConfirmPassword(e.target.value)}
            placeholder="Masukkan password Anda..."
            className="w-full px-3.5 py-2.5 bg-[#080C14] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
          />
        </div>
      </ConfirmModal>

      {/* Header */}
      <div className="flex items-center gap-3 bg-[#0C121E] border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-2xl text-[#CCFF00]">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Pengaturan Akun & Profil</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola informasi data akun investor dan keamanan akses Anda
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Edit Profile Form (DPPL 3.1.3.2) */}
        <div className="md:col-span-8 bg-[#0C121E] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
            Informasi Data Akun
          </h2>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-[#CCFF00] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-[#CCFF00] font-mono transition"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-4">
              <span className="text-xs font-bold text-[#CCFF00] uppercase tracking-wider block">
                Ganti Password (Opsional)
              </span>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password Lama
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Wajib diisi jika ganti password..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-[#CCFF00] font-mono transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password Baru (min. 8 karakter)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password pengganti..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-[#CCFF00] font-mono transition"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="py-3 px-6 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)] flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </form>
        </div>

        {/* Right: Account Summary & Danger Zone (DPPL Hapus Akun) */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-[#0C121E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#CCFF00]" />
              Ringkasan Status Akun
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                <span>Peran:</span>
                <span className="text-[#CCFF00] font-bold">Investor Ritel</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                <span>Status Akun:</span>
                <span className="text-emerald-400 font-bold">Aktif Terverifikasi</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                <span>Akses Fitur:</span>
                <span className="text-slate-200">Full Access (AI included)</span>
              </div>
              <div className="flex justify-between py-1.5 text-slate-400">
                <span>Bergabung Sejak:</span>
                <span className="font-mono text-slate-300">
                  {user?.created_at?.slice(0, 10) || '2026-09-01'}
                </span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-[#0C121E] border border-rose-500/30 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Hapus Akun
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Akun akan dinonaktifkan secara aman (soft delete). Sesi watchlist dan riwayat analisis Anda akan diarsipkan.
            </p>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Akun Saya</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
