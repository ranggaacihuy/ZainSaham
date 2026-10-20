import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WatchlistProvider } from './context/WatchlistContext';
import AppLayout from './components/AppLayout';
import NotFound from './components/NotFound';
import DashboardPage from './pages/DashboardPage';
import StockListPage from './pages/StockListPage';
import StockDetailPage from './pages/StockDetailPage';
import WatchlistPage from './pages/WatchlistPage';
import AiAnalysisPage from './pages/AiAnalysisPage';
import AnalysisHistoryPage from './pages/AnalysisHistoryPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-muted">
        Memuat sesi…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function GuestOnly({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WatchlistProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestOnly>
                    <RegisterPage />
                  </GuestOnly>
                }
              />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/stocks" element={<StockListPage />} />
                <Route path="/stocks/:ticker" element={<StockDetailPage />} />
                <Route path="/saham/:ticker" element={<StockDetailPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="/ai-analysis" element={<AiAnalysisPage />} />
                <Route path="/analysis-history" element={<AnalysisHistoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WatchlistProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
