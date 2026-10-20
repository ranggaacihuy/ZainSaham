import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
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

// TODO: aktifkan saat backend punya auth Sanctum.
// import LoginPage from './pages/LoginPage';
// import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WatchlistProvider>
          <BrowserRouter>
            <Routes>
              {/* TODO: aktifkan saat backend punya auth Sanctum */}
              {/* <Route path="/login" element={<LoginPage />} /> */}
              {/* <Route path="/register" element={<RegisterPage />} /> */}

              <Route element={<AppLayout />}>
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
