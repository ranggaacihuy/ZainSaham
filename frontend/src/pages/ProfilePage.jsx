import { Card, PageHeader } from '../components/ui';
import { displayName, useAuth } from '../context/AuthContext';
import { date } from '../lib/format';

export default function ProfilePage() {
  const { user } = useAuth();

  const rows = [
    { label: 'ID pengguna', value: user.user_id, num: true },
    { label: 'Nama', value: user.name || displayName(user) },
    { label: 'Email', value: user.email || 'Belum tersedia dari backend' },
    ...(user.created_at ? [{ label: 'Tanggal bergabung', value: date(user.created_at) }] : []),
  ];

  return (
    <>
      <PageHeader title="Profil" description="Informasi akun yang aktif pada sesi ini." />

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

        <p className="text-xs text-text-muted">
          Pengubahan profil, kata sandi, dan penghapusan akun belum tersedia karena backend belum menyediakan endpoint
          autentikasi dan profil pengguna. ID pengguna aktif diatur melalui variabel lingkungan{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-text">VITE_USER_ID</code>.
        </p>
      </div>
    </>
  );
}
