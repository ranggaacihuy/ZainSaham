import { Link } from 'react-router-dom';
import { Button } from './ui';

/** Halaman 404 yang rapi, dipakai untuk rute tak dikenal dan ticker yang tidak ada. */
export default function NotFound({ title = 'Halaman tidak ditemukan', message, actionLabel = 'Ke dashboard', actionTo = '/dashboard' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <p className="num text-display font-semibold text-text-muted">404</p>
      <h1 className="mt-2 text-xl font-semibold text-text">{title}</h1>
      {message && <p className="mt-1 max-w-md text-sm text-text-muted">{message}</p>}
      <Button as={Link} to={actionTo} className="mt-6">
        {actionLabel}
      </Button>
    </div>
  );
}

