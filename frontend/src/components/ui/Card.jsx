export function Card({ title, description, action, children, className = '', bodyClassName = '', padded = true, as: Component = 'section' }) {
  const hasHeader = title || action;
  return (
    <Component className={`rounded-cards bg-surface shadow-subtle ${className}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-base font-medium tracking-[-0.01em] text-text">{title}</h2>}
            {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`${padded ? 'p-5 sm:p-6' : ''} ${bodyClassName}`}>{children}</div>
    </Component>
  );
}
