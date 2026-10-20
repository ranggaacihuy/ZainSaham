// TODO: aktifkan saat backend punya auth Sanctum.
// Halaman ini disembunyikan dari rute & navigasi selama backend belum memiliki endpoint /register.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { Button, Card, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fieldError } from '../api/client';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirmation) {
      setError({ message: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password, passwordConfirmation);
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

        <Card title="Daftar" description="Buat akun baru ZainSaham.">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p role="alert" className="text-sm text-down">
                {error.message}
              </p>
            )}

            <Field label="Nama" htmlFor="register-name" error={fieldError(error, 'name')}>
              <Input
                id="register-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="Email" htmlFor="register-email" error={fieldError(error, 'email')}>
              <Input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Kata sandi" htmlFor="register-password" error={fieldError(error, 'password')}>
              <Input
                id="register-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Field label="Konfirmasi kata sandi" htmlFor="register-password-confirm">
              <Input
                id="register-password-confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
              />
            </Field>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Memproses…' : 'Daftar'}
            </Button>
          </form>

          <p className="mt-4 text-xs text-text-muted">
            Sudah punya akun?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Masuk
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
