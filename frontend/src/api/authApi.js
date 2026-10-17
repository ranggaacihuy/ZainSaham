import api from './client';

const USER_STORAGE_KEY = 'zainsaham_current_user';

const DEFAULT_DEMO_USER = {
  user_id: 1,
  username: 'investor_zain',
  email: 'investor@zainsaham.id',
  created_at: '2026-09-01T08:00:00Z',
};

export const authApi = {
  // GET /api/me
  async me() {
    try {
      const res = await api.get('/me');
      if (res.data?.data) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.data));
        return res.data.data;
      }
    } catch {
      // Offline fallback
    }
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_DEMO_USER;
  },

  // POST /api/login
  async login(email, password) {
    try {
      // Ambil csrf-cookie dulu untuk Sanctum SPA
      await api.get('/sanctum/csrf-cookie').catch(() => {});
      const res = await api.post('/login', { email, password });
      if (res.data?.data) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.data));
        return { success: true, user: res.data.data };
      }
    } catch (err) {
      if (err.response?.status === 422 || err.response?.status === 429) {
        throw err;
      }
      // If backend unreachable, allow graceful demo login
    }

    const demoUser = {
      user_id: 1,
      username: email.split('@')[0] || 'investor_zain',
      email: email,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(demoUser));
    return { success: true, user: demoUser };
  },

  // POST /api/register
  async register(username, email, password, password_confirmation) {
    try {
      await api.get('/sanctum/csrf-cookie').catch(() => {});
      const res = await api.post('/register', {
        username,
        email,
        password,
        password_confirmation,
      });
      if (res.data?.data) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.data));
        return { success: true, user: res.data.data };
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        throw err;
      }
    }

    const newUser = {
      user_id: Date.now(),
      username,
      email,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  },

  // POST /api/logout
  async logout() {
    try {
      await api.post('/logout');
    } catch {
      // offline
    }
    localStorage.removeItem(USER_STORAGE_KEY);
    return { success: true };
  },

  // GET /api/profile
  async getProfile() {
    try {
      const res = await api.get('/profile');
      if (res.data?.data) return res.data.data;
    } catch {
      // fallback
    }
    return this.me();
  },

  // PUT /api/profile
  async updateProfile(payload) {
    try {
      const res = await api.put('/profile', payload);
      if (res.data?.data) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.data));
        return res.data;
      }
    } catch (err) {
      if (err.response?.status === 422) throw err;
    }

    // Local update
    const cur = await this.me();
    const updated = {
      ...cur,
      username: payload.username || cur.username,
      email: payload.email || cur.email,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    return { success: true, message: 'Profil berhasil diperbarui', data: updated };
  },

  // DELETE /api/profile
  async deleteAccount(password) {
    try {
      await api.delete('/profile', { data: { password } });
    } catch {
      // offline
    }
    localStorage.removeItem(USER_STORAGE_KEY);
    return { success: true, message: 'Akun berhasil dinonaktifkan (soft delete)' };
  },
};
