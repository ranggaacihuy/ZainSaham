// TODO: aktifkan saat backend punya auth Sanctum.
// Halaman ini disembunyikan dari rute & navigasi selama backend belum memiliki endpoint /login.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { Button, Card, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fieldError } from '../api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-100">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink" aria-hidden="true">
            <LineChart className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-base font-semibold text-text">ZainSaham</span>
        </div>

        <Card title="Masuk" description="Masuk dengan akun ZainSaham Anda.">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p role="alert" className="text-sm text-down">
                {error.message}
              </p>
            )}

            <Field label="Email" htmlFor="login-email" error={fieldError(error, 'email')}>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Kata sandi" htmlFor="login-password" error={fieldError(error, 'password')}>
              <Input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          <p className="mt-4 text-xs text-text-muted">
            Belum punya akun?{' '}
            <Link to="/register" className="font-medium text-accent hover:underline">
              Daftar
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
