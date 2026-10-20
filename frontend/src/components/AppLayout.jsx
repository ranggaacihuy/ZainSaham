import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, History, LayoutDashboard, LineChart, MessageSquareText, Search, User } from 'lucide-react';
import { displayName, useAuth } from '../context/AuthContext';
import SearchModal from './SearchModal';

const NAV_ITEMS = [
  { label: 'Dashboard', short: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, match: ['/dashboard', '/'] },
  { label: 'Daftar Saham', short: 'Saham', path: '/stocks', icon: LineChart, match: ['/stocks', '/saham'] },
  { label: 'Watchlist', short: 'Watchlist', path: '/watchlist', icon: Bookmark, match: ['/watchlist'] },
  { label: 'Analisis AI', short: 'Analisis', path: '/ai-analysis', icon: MessageSquareText, match: ['/ai-analysis'] },
  { label: 'Riwayat', short: 'Riwayat', path: '/analysis-history', icon: History, match: ['/analysis-history'] },
  { label: 'Profil', short: 'Profil', path: '/profile', icon: User, match: ['/profile'] },
];

function isActive(item, pathname) {
  return item.match.some((m) => (m === '/' ? pathname === '/' : pathname === m || pathname.startsWith(`${m}/`)));
}

function Brand() {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink" aria-hidden="true">
        <LineChart className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="text-base font-semibold text-text">ZainSaham</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Kembali ke atas setiap pindah halaman.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const current = NAV_ITEMS.find((item) => isActive(item, location.pathname));
  const mobileItems = NAV_ITEMS.slice(0, 5);

  return (
    <div className="min-h-screen bg-bg text-text md:flex">
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-58 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center px-5">
          <Brand />
        </div>
        <nav aria-label="Navigasi utama" className="flex-1 space-y-0.5 px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, location.pathname);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? 'bg-surface-2 font-medium text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-border px-5 py-4">
          <p className="truncate text-sm font-medium text-text">{displayName(user)}</p>
          <p className="truncate text-xs text-text-muted">{user.email || `ID pengguna ${user.user_id}`}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="md:hidden">
              <Brand />
            </div>
            <p className="hidden truncate text-sm font-medium text-text md:block">{current?.label || 'ZainSaham'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
              aria-label="Cari saham"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden flex-1 text-left sm:inline">Cari saham</span>
              <kbd className="hidden rounded border border-border px-1.5 text-xs text-text-muted sm:inline">Ctrl K</kbd>
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Profil"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors duration-150 hover:bg-surface-2 md:hidden ${
                location.pathname === '/profile' ? 'text-text' : 'text-text-muted'
              }`}
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar mobile */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-surface md:hidden"
      >
        {mobileItems.map((item) => {
          const active = isActive(item, location.pathname);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-xs transition-colors duration-150 ${
                active ? 'text-text' : 'text-text-muted'
              }`}
            >
              {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />}
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.short}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
