import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi, logoutApi, meApi, registerApi } from '../api/auth';
import { getAuthToken, setAuthToken } from '../api/client';
import { normalizeUser } from '../api/normalize';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'zainsaham_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const user = normalizeUser(parsed);
    return user?.user_id ? user : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Abaikan bila localStorage tidak tersedia.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getAuthToken() ? readStoredUser() : null));
  const [loading, setLoading] = useState(() => Boolean(getAuthToken()));

  const saveSession = useCallback((nextUser, token) => {
    setAuthToken(token);
    writeStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    setAuthToken(null);
    writeStoredUser(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;

    let cancelled = false;
    meApi()
      .then((freshUser) => {
        if (!cancelled && freshUser?.user_id) {
          writeStoredUser(freshUser);
          setUser(freshUser);
        }
      })
      .catch((err) => {
        if (!cancelled && err?.status === 401) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(
    async (email, password) => {
      const { user: loggedInUser, token } = await loginApi(email, password);
      saveSession(loggedInUser, token);
      return loggedInUser;
    },
    [saveSession],
  );

  const register = useCallback(
    async (name, email, password, passwordConfirmation) => {
      const { user: registeredUser, token } = await registerApi(name, email, password, passwordConfirmation);
      saveSession(registeredUser, token);
      return registeredUser;
    },
    [saveSession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Tetap bersihkan sesi lokal meskipun request logout gagal.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user?.user_id),
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}

/** Nama tampilan user: nama akun atau "Pengguna #ID". */
// oxlint-disable-next-line react/only-export-components
export function displayName(user) {
  return user?.name || `Pengguna #${user?.user_id ?? '-'}`;
}
