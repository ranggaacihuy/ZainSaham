import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, History, LayoutDashboard, LineChart, LogOut, MessageSquareText, Moon, Sun } from 'lucide-react';
import { displayName, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SearchModal from './SearchModal';
import { Logo } from './ui/Logo';

const NAV_ITEMS = [
  { label: 'Dashboard', short: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, match: ['/dashboard', '/'] },
  { label: 'Daftar Saham', short: 'Saham', path: '/stocks', icon: LineChart, match: ['/stocks', '/saham'] },
  { label: 'Watchlist', short: 'Watchlist', path: '/watchlist', icon: Bookmark, match: ['/watchlist'] },
  { label: 'Analisis AI', short: 'Analisis', path: '/ai-analysis', icon: MessageSquareText, match: ['/ai-analysis'] },
  { label: 'Riwayat', short: 'Riwayat', path: '/analysis-history', icon: History, match: ['/analysis-history'] },
];

function isActive(item, pathname) {
  return item.match.some((m) => (m === '/' ? pathname === '/' : pathname === m || pathname.startsWith(`${m}/`)));
}

function Brand() {
  return (
    <NavLink
      to="/dashboard"
      aria-label="ZainSaham — Dashboard"
      className="flex items-center rounded-badges focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris"
    >
      <Logo />
    </NavLink>
  );
}

function initials(name) {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const current =
    NAV_ITEMS.find((item) => isActive(item, location.pathname)) ||
    (location.pathname.startsWith('/profile') ? { label: 'Profil' } : null);
  const mobileItems = NAV_ITEMS;
  const name = displayName(user);
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="relative flex h-16 w-full items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Brand />
            <span className="hidden truncate text-sm text-text-muted sm:inline lg:hidden">/ {current?.label || 'ZainSaham'}</span>
          </div>

          <nav
            aria-label="Navigasi utama"
            className="hidden items-center gap-1 lg:absolute lg:left-1/2 lg:flex lg:-translate-x-1/2"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item, location.pathname);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-9 items-center rounded-badges px-4 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris ${
                    active ? 'bg-accent text-accent-ink' : 'text-text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <SearchModal enableShortcut align="right" />

            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
              aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-badges border border-border bg-surface-2 text-text-muted transition-colors duration-150 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris"
            >
              {isDark ? (
                <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Profil"
              title={name}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-badges bg-accent text-xs font-medium text-accent-ink transition-opacity duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2 ${
                location.pathname === '/profile' ? 'ring-2 ring-border-strong ring-offset-2 ring-offset-surface' : ''
              }`}
            >
              {initials(name)}
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Keluar"
              aria-label="Keluar dari akun"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-badges text-text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris sm:flex"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-6 pb-28 pt-8 lg:pb-16 lg:pt-8">
        <Outlet />
      </main>

      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-3 bottom-3 z-30 grid h-16 grid-cols-5 rounded-badges border border-border bg-surface/95 backdrop-blur-md lg:hidden"
      >
        {mobileItems.map((item) => {
          const active = isActive(item, location.pathname);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-micro transition-colors duration-150 ${
                active ? 'font-medium text-text' : 'text-text-muted'
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-badges transition-colors duration-150 ${
                  active ? 'bg-accent text-accent-ink' : ''
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              {item.short}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
