import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, PageHeader } from '../components/ui';
import { displayName, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fieldError } from '../api/client';
import { date } from '../lib/format';

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'U';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function FormError({ error }) {
  if (!error || Object.keys(error.fieldErrors || {}).length > 0) return null;
  return (
    <p role="alert" className="text-sm text-down">
      {error.message}
    </p>
  );
}

function ProfileForm({ user, onSave }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== (user?.email || '').toLowerCase();

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ name, email, currentPassword }, 'Profil berhasil diperbarui.');
      setCurrentPassword('');
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-cards bg-surface shadow-subtle">
      <div className="space-y-4 p-5 sm:p-6">
        <FormError error={error} />
        <Field label="Nama" htmlFor="profile-name" error={fieldError(error, 'name')}>
          <Input id="profile-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="profile-email" error={fieldError(error, 'email')}>
          <Input id="profile-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        {emailChanged && (
          <Field
            label="Kata sandi saat ini"
            htmlFor="profile-current-password"
            hint="Diperlukan untuk mengganti email."
            error={fieldError(error, 'current_password')}
          >
            <Input
              id="profile-current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        )}
      </div>
      <div className="flex items-center justify-end border-t border-border bg-bg/40 px-5 py-3.5 sm:px-6">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ user, onSave }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(
        { name: user?.name || '', email: user?.email || '', currentPassword, password, passwordConfirmation },
        'Kata sandi berhasil diubah.',
      );
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-cards bg-surface shadow-subtle">
      <div className="space-y-4 p-5 sm:p-6">
        <FormError error={error} />
        <Field label="Kata sandi saat ini" htmlFor="password-current" error={fieldError(error, 'current_password')}>
          <Input
            id="password-current"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kata sandi baru" htmlFor="password-new" error={fieldError(error, 'password')}>
            <Input
              id="password-new"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Ulangi kata sandi baru" htmlFor="password-confirm">
            <Input
              id="password-confirm"
              type="password"
              required
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-border bg-bg/40 px-5 py-3.5 sm:px-6">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Ubah kata sandi'}
        </Button>
      </div>
    </form>
  );
}

function DeleteAccountModal({ open, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    if (deleting) return;
    setPassword('');
    setError(null);
    onClose();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await onConfirm(password);
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Hapus akun"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={deleting}>
            Batal
          </Button>
          <Button type="submit" form="delete-account-form" variant="danger" disabled={deleting || !password}>
            {deleting ? 'Memproses…' : 'Hapus akun'}
          </Button>
        </>
      }
    >
      <form id="delete-account-form" onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-text-muted">
          Akun, watchlist, dan riwayat analisis Anda tidak bisa diakses lagi setelah dihapus. Masukkan kata sandi untuk
          melanjutkan.
        </p>
        <FormError error={error} />
        <Field label="Kata sandi" htmlFor="delete-password" error={fieldError(error, 'password')}>
          <Input
            id="delete-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
      </form>
    </Modal>
  );
}

export default function ProfilePage() {
  const { user, logout, updateProfile, deleteAccount } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const onSave = async (changes, message) => {
    await updateProfile(changes);
    addToast(message, 'success');
  };

  const onDelete = async (password) => {
    await deleteAccount(password);
    addToast('Akun berhasil dihapus.', 'success');
    navigate('/login', { replace: true });
  };

  const name = user?.name || displayName(user);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Profil" description="Kelola informasi akun yang aktif pada sesi ini." />

      <DeleteAccountModal open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={onDelete} />

      <div className="space-y-8">
        {/* 1. Executive Identity Banner */}
        <section className="flex flex-col justify-between gap-5 rounded-cards bg-surface p-6 shadow-subtle sm:flex-row sm:items-center">
          <div className="flex items-start gap-4 sm:items-center sm:gap-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-badges border border-border bg-accent text-lg font-semibold text-accent-ink ring-4 ring-bg"
              aria-hidden="true"
            >
              {initials(name)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-text">{name}</h2>
              <p className="mt-0.5 truncate text-sm text-text-muted">{user?.email || '–'}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="num inline-flex items-center rounded-[6px] border border-border bg-bg px-2.5 py-0.5 text-xs font-medium text-text-muted">
                  ID Pengguna #{user?.user_id ?? '–'}
                </span>
                {user?.created_at && (
                  <span className="num inline-flex items-center rounded-[6px] border border-border bg-bg px-2.5 py-0.5 text-xs font-medium text-text-muted">
                    Bergabung {date(user.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <Button variant="secondary" icon={LogOut} onClick={onLogout} disabled={loggingOut}>
              {loggingOut ? 'Memproses…' : 'Keluar'}
            </Button>
          </div>
        </section>

        {/* 2. Two-Column Editorial Settings Sections */}
        <div className="space-y-8 divide-y divide-border">
          {/* Section 1: Ubah Profil */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-base font-medium text-text">Ubah profil</h2>
              <p className="mt-1 text-sm text-text-muted">
                Perbarui nama dan alamat email yang terhubung dengan akun ZainSaham Anda.
              </p>
            </div>
            <div className="lg:col-span-8">
              <ProfileForm key={`${user?.name}-${user?.email}`} user={user} onSave={onSave} />
            </div>
          </section>

          {/* Section 2: Ubah Kata Sandi */}
          <section className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-base font-medium text-text">Ubah kata sandi</h2>
              <p className="mt-1 text-sm text-text-muted">
                Gunakan minimal 8 karakter kombinasi huruf dan angka untuk menjaga keamanan akun.
              </p>
            </div>
            <div className="lg:col-span-8">
              <PasswordForm user={user} onSave={onSave} />
            </div>
          </section>

          {/* Section 3: Zona Berbahaya */}
          <section className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-base font-medium text-text">Zona berbahaya</h2>
              <p className="mt-1 text-sm text-text-muted">
                Tindakan permanen yang akan menghapus seluruh data akun, daftar pantau, dan riwayat analisis Anda.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="flex flex-col justify-between gap-4 rounded-cards border border-down/30 bg-down/[0.03] p-5 sm:flex-row sm:items-center sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-text">Hapus akun</h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    Menonaktifkan akun ini secara permanen. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                    Hapus akun
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
