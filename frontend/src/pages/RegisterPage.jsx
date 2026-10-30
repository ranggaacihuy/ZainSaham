import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Field, Input } from '../components/ui';
import AuthLayout from '../components/AuthLayout';
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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Akun baru"
      title="Buat akun ZainSaham"
      description="Mulai pantau saham, susun watchlist, dan simpan riwayat analisis Anda."
      switchText="Sudah punya akun?"
      switchLabel="Masuk"
      switchTo="/login"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error && (
          <p role="alert" className="rounded-inputs border border-down/20 bg-down/5 px-4 py-3 text-caption text-down">
            {error.message}
          </p>
        )}

        <Field label="Nama" htmlFor="register-name" error={fieldError(error, 'name')}>
          <Input
            id="register-name"
            type="text"
            required
            autoComplete="name"
            className="h-12 text-body-sm"
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
            placeholder="nama@email.com"
            className="h-12 text-body-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Kata sandi" htmlFor="register-password" error={fieldError(error, 'password')}>
            <Input
              id="register-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-12 text-body-sm"
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
              className="h-12 text-body-sm"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
          </Field>
        </div>

        <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink" aria-hidden="true" />
              Memproses…
            </>
          ) : (
            <>
              Daftar
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
