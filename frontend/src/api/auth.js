import api, { unwrap } from './client';
import { normalizeUser } from './normalize';

// POST /login → { user, token }
export async function loginApi(email, password) {
  const res = await api.post('/login', { email, password });
  const data = unwrap(res);
  return {
    user: normalizeUser(data?.user),
    token: data?.token || null,
  };
}

// POST /register → { user, token }
export async function registerApi(name, email, password, passwordConfirmation) {
  const res = await api.post('/register', {
    name,
    email,
    password,
    password_confirmation: passwordConfirmation,
  });
  const data = unwrap(res);
  return {
    user: normalizeUser(data?.user),
    token: data?.token || null,
  };
}

// GET /me → user
export async function meApi() {
  const res = await api.get('/me');
  return normalizeUser(unwrap(res));
}

// POST /logout
export async function logoutApi() {
  const res = await api.post('/logout');
  unwrap(res);
  return true;
}

export async function updateProfileApi({ name, email, currentPassword, password, passwordConfirmation }) {
  const res = await api.put('/profile', {
    name,
    email,
    current_password: currentPassword || undefined,
    password: password || undefined,
    password_confirmation: passwordConfirmation || undefined,
  });
  return normalizeUser(unwrap(res));
}

export async function deleteAccountApi(password) {
  const res = await api.delete('/profile', { data: { password } });
  unwrap(res);
  return true;
}

