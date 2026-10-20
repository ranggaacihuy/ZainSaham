/** Satu-satunya gaya kartu: datar, border 1px, radius 12px. */
export function Card({ title, description, action, children, className = '', bodyClassName = '', padded = true, as: Component = 'section' }) {
  const hasHeader = title || action;
  return (
    <Component className={`rounded-xl border border-border bg-surface ${className}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`${padded ? 'p-4 sm:p-5' : ''} ${bodyClassName}`}>{children}</div>
    </Component>
  );
}

export default Card;

