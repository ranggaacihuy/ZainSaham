import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('investor@zainsaham.id');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Silakan isi email dan password.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Email atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('investor@zainsaham.id');
    setPassword('password123');
    try {
      setLoading(true);
      await login('investor@zainsaham.id', 'password123');
      navigate('/dashboard');
    } catch (err) {
      setError('Login demo gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background neon ambient lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#CCFF00]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0C121E] border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand logo header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#CCFF00] text-[#080C14] font-black text-2xl shadow-[0_0_25px_rgba(204,255,0,0.4)] mb-4">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Zain<span className="text-[#CCFF00]">Saham</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Platform Analisis Saham Berbasis Artificial Intelligence
          </p>
        </div>

        {/* Error Alert (DPPL UC02) */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-4 py-3 bg-[#080C14] border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[#080C14] border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl text-xs font-bold bg-[#CCFF00] text-[#080C14] hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)] flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Memproses...' : 'Masuk'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Fast Login Shortcut */}
        <div className="mt-5 pt-5 border-t border-slate-800 text-center">
          <button
            onClick={handleDemoLogin}
            type="button"
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-[#CCFF00] border border-slate-700/60 flex items-center justify-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
            <span>Masuk Cepat (Akun Demo)</span>
          </button>
        </div>

        {/* Footer Register Link */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Belum punya akun?{' '}
          <Link
            to="/register"
            className="text-[#CCFF00] font-bold hover:underline ml-1"
          >
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
