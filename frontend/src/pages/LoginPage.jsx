import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Field, Input } from '../components/ui';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { fieldError } from '../api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Selamat datang kembali"
      title="Masuk ke ZainSaham"
      description="Masuk dengan akun ZainSaham Anda untuk melanjutkan analisis."
      switchText="Belum punya akun?"
      switchLabel="Daftar"
      switchTo="/register"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error && (
          <p role="alert" className="rounded-inputs border border-down/20 bg-down/5 px-4 py-3 text-caption text-down">
            {error.message}
          </p>
        )}

        <Field label="Email" htmlFor="login-email" error={fieldError(error, 'email')}>
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="nama@email.com"
            className="h-12 text-body-sm"
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
            placeholder="••••••••"
            className="h-12 text-body-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink" aria-hidden="true" />
              Memproses…
            </>
          ) : (
            <>
              Masuk
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
