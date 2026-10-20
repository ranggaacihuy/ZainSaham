import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import StockListPage from './pages/StockListPage';
import StockDetailPage from './pages/StockDetailPage';
import WatchlistPage from './pages/WatchlistPage';
import AiAnalysisPage from './pages/AiAnalysisPage';
import AnalysisHistoryPage from './pages/AnalysisHistoryPage';
import ProfilePage from './pages/ProfilePage';

// Protected Route Guard
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Memuat ZainSaham...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stocks"
              element={
                <ProtectedRoute>
                  <StockListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stocks/:ticker"
              element={
                <ProtectedRoute>
                  <StockDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/saham/:ticker"
              element={
                <ProtectedRoute>
                  <StockDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlist"
              element={
                <ProtectedRoute>
                  <WatchlistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-analysis"
              element={
                <ProtectedRoute>
                  <AiAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis-history"
              element={
                <ProtectedRoute>
                  <AnalysisHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
