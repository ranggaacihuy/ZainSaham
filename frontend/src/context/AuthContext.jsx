import { createContext, useContext, useMemo } from 'react';
import config from '../config';
import { ApiError } from '../api/client';

const AuthContext = createContext(null);

// TODO: aktifkan saat backend punya auth Sanctum.
// Backend belum punya /login, /register, /logout, maupun /me. Sampai saat itu,
// identitas user diambil dari satu sumber terpusat: VITE_USER_ID di src/config.js.
// Nama & email opsional (VITE_USER_NAME / VITE_USER_EMAIL) karena backend juga belum
// punya endpoint profil user.
function authUnavailable() {
  return Promise.reject(
    new ApiError({ status: 501, message: 'Autentikasi belum tersedia di backend.' }),
  );
}

export function AuthProvider({ children }) {
  const value = useMemo(
    () => ({
      user: {
        user_id: config.userId,
        name: config.userName || null,
        email: config.userEmail || null,
        created_at: null,
      },
      loading: false,
      isAuthenticated: true,
      // Antarmuka dipertahankan untuk halaman Login/Register yang sedang disembunyikan.
      login: authUnavailable,
      register: authUnavailable,
      logout: authUnavailable,
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}

/** Nama tampilan user: nama dari konfigurasi, atau "Pengguna #ID". */
// oxlint-disable-next-line react/only-export-components
export function displayName(user) {
  return user?.name || `Pengguna #${user?.user_id ?? '-'}`;
}
