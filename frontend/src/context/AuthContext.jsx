import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    async function initAuth() {
      try {
        const currentUser = await authApi.me();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setUser(res.user);
      addToast(`Selamat datang kembali, ${res.user.username}!`, 'success');
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login gagal. Periksa kembali email dan password.';
      addToast(msg, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password, password_confirmation) => {
    setLoading(true);
    try {
      const res = await authApi.register(username, email, password, password_confirmation);
      setUser(res.user);
      addToast('Akun berhasil dibuat! Selamat bergabung di ZainSaham.', 'success');
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registrasi gagal. Silakan coba kembali.';
      addToast(msg, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
      setUser(null);
      addToast('Berhasil keluar dari akun.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data) => {
    try {
      const res = await authApi.updateProfile(data);
      if (res.data) setUser(res.data);
      addToast('Profil berhasil diperbarui.', 'success');
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal memperbarui profil.';
      addToast(msg, 'error');
      throw err;
    }
  };

  const deleteAccount = async (password) => {
    try {
      await authApi.deleteAccount(password);
      setUser(null);
      addToast('Akun telah dinonaktifkan.', 'info');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menghapus akun.';
      addToast(msg, 'error');
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
