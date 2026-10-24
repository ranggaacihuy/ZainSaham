import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, Modal, PageHeader } from '../components/ui';
import { displayName, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fieldError } from '../api/client';
import { date } from '../lib/format';

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
    <Card title="Ubah profil" description="Perbarui nama dan email akun Anda.">
      <form onSubmit={onSubmit} className="space-y-4">
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
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </form>
    </Card>
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
    <Card title="Ubah kata sandi" description="Gunakan minimal 8 karakter.">
      <form onSubmit={onSubmit} className="space-y-4">
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
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Ubah kata sandi'}
        </Button>
      </form>
    </Card>
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

  const rows = [
    { label: 'ID pengguna', value: user?.user_id ?? '–', num: true },
    { label: 'Nama', value: user?.name || displayName(user) },
    { label: 'Email', value: user?.email || '–' },
    ...(user?.created_at ? [{ label: 'Tanggal bergabung', value: date(user.created_at) }] : []),
  ];

  return (
    <>
      <PageHeader title="Profil" description="Kelola informasi akun yang aktif pada sesi ini." />

      <DeleteAccountModal open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={onDelete} />

      <div className="max-w-xl space-y-4">
        <Card title="Akun" padded={false}>
          <dl>
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <dt className="text-xs text-text-muted">{row.label}</dt>
                <dd className={`text-sm text-text ${row.num ? 'num' : ''}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <ProfileForm key={`${user?.name}-${user?.email}`} user={user} onSave={onSave} />
        <PasswordForm user={user} onSave={onSave} />

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-medium text-text">Keluar dari akun</p>
            <p className="text-xs text-text-muted">Akhiri sesi aktif pada perangkat ini.</p>
          </div>
          <Button variant="secondary" size="sm" icon={LogOut} onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? 'Memproses…' : 'Keluar'}
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-down/40 bg-surface px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-medium text-text">Hapus akun</p>
            <p className="text-xs text-text-muted">Menonaktifkan akun ini secara permanen.</p>
          </div>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
            Hapus akun
          </Button>
        </div>
      </div>
    </>
  );
}
