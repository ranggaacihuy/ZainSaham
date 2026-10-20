import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function Skeleton({ className = '', style }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-2 ${className}`} style={style} />;
}

/** Beberapa baris skeleton untuk blok teks. */
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

/** Empty state: satu kalimat + satu aksi. */
export function EmptyState({ message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-4 py-10 text-center ${className}`}>
      <p className="text-sm text-text-muted">{message}</p>
      {action}
    </div>
  );
}

/** Error state: pesan + "Coba lagi". */
export function ErrorState({ error, message, onRetry, className = '', compact = false }) {
  const text = message || error?.message || 'Gagal memuat data.';
  if (compact) {
    return (
      <div role="alert" className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
        <span className="text-down">{text}</span>
        {onRetry && (
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRetry}>
            Coba lagi
          </Button>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 px-4 py-10 text-center ${className}`}>
      <p className="max-w-md text-sm text-text">{text}</p>
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {children}
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        {description && <p className="mt-1 truncate text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

