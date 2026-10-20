import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button, Card, PageHeader } from '../components/ui';
import { displayName, useAuth } from '../context/AuthContext';
import { date } from '../lib/format';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const rows = [
    { label: 'ID pengguna', value: user?.user_id ?? '–', num: true },
    { label: 'Nama', value: user?.name || displayName(user) },
    { label: 'Email', value: user?.email || '–' },
    ...(user?.created_at ? [{ label: 'Tanggal bergabung', value: date(user.created_at) }] : []),
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

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-medium text-text">Keluar dari akun</p>
            <p className="text-xs text-text-muted">Akhiri sesi aktif pada perangkat ini.</p>
          </div>
          <Button variant="secondary" size="sm" icon={LogOut} onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? 'Memproses…' : 'Keluar'}
          </Button>
        </div>
      </div>
    </>
  );
}
