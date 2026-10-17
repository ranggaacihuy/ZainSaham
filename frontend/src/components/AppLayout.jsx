import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Bookmark,
  Sparkles,
  History,
  User,
  LogOut,
  Search,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SearchModal from './SearchModal';
import ConfirmModal from './ConfirmModal';

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Daftar Saham', path: '/stocks', icon: TrendingUp },
    { name: 'Watchlist', path: '/watchlist', icon: Bookmark },
    { name: 'Analisis AI', path: '/ai-analysis', icon: Sparkles },
    { name: 'Riwayat Analisis', path: '/analysis-history', icon: History },
    { name: 'Profil', path: '/profile', icon: User },
  ];

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col md:flex-row">
      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Keluar dari ZainSaham"
        message="Apakah Anda yakin ingin keluar dari sesi ini?"
        confirmText="Keluar"
        isDanger={true}
        onConfirm={handleConfirmLogout}
        onClose={() => setIsLogoutModalOpen(false)}
      />

      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0B101B] border-r border-slate-800/80 p-5 shrink-0 justify-between select-none">
        <div className="space-y-8">
          {/* Logo & Brand */}
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#CCFF00] flex items-center justify-center text-[#080C14] font-black text-xl shadow-[0_0_20px_rgba(204,255,0,0.4)] group-hover:scale-105 transition">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight text-white flex items-center">
                Zain<span className="text-[#CCFF00]">Saham</span>
              </div>
              <div className="text-[10px] font-semibold tracking-widest text-[#CCFF00]/80 uppercase">
                AI Stock Analytics
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path === '/stocks' && location.pathname.startsWith('/stocks/'));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#CCFF00] text-[#080C14] shadow-[0_0_20px_rgba(204,255,0,0.3)] translate-x-1'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#080C14]' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Button */}
        <div className="space-y-3 pt-6 border-t border-slate-800/80">
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-800/40 cursor-pointer transition"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-[#CCFF00]">
              {(user?.username?.[0] || 'U').toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">
                {user?.username || 'Investor'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user?.email || 'user@zainsaham.id'}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition border border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-[#0B101B] border-b border-slate-800 sticky top-0 z-40">
        <div
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-[#CCFF00] flex items-center justify-center text-[#080C14] font-black text-sm shadow-[0_0_12px_rgba(204,255,0,0.3)]">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <span className="font-extrabold text-lg text-white">
            Zain<span className="text-[#CCFF00]">Saham</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 rounded-xl bg-slate-800/80 text-[#CCFF00]"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-800/80 text-white"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-[#CCFF00]" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#0B101B] border-b border-slate-800 p-4 space-y-3 z-40">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold ${
                    isActive ? 'bg-[#CCFF00] text-[#080C14]' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Login sebagai: {user?.username}</span>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsLogoutModalOpen(true);
              }}
              className="text-xs text-rose-400 font-semibold"
            >
              Keluar
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Desktop Navigation & Search Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-[#080C14]/90 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-30">
          {/* Quick Search */}
          <div
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-3 w-96 px-4 py-2.5 bg-[#0e1422] border border-slate-800 rounded-2xl text-xs text-slate-400 hover:border-[#CCFF00]/50 hover:text-slate-300 cursor-pointer transition group"
          >
            <Search className="w-4 h-4 text-[#CCFF00] group-hover:scale-110 transition" />
            <span className="flex-1">Cari kode saham (cth: BBCA, TLKM, ASII)...</span>
            <kbd className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono">
              Ctrl+K
            </kbd>
          </div>

          {/* Market Status & Right details */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Bursa Efek Indonesia (IDX)</span>
              <span className="text-slate-400 font-mono text-[11px]">• Real-Time Ready</span>
            </div>

            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
            >
              <div className="w-8 h-8 rounded-full bg-[#CCFF00] text-[#080C14] font-bold text-xs flex items-center justify-center shadow-[0_0_12px_rgba(204,255,0,0.3)]">
                {(user?.username?.[0] || 'U').toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-white">{user?.username || 'Investor'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
