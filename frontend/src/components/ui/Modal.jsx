import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, children, footer, size = 'md', initialFocusRef }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const focusTarget = initialFocusRef?.current || panelRef.current;
    focusTarget?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const width = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-start sm:p-4 sm:pt-[10vh]">
      <div className="absolute inset-0 bg-void/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full ${width} flex-col rounded-t-images border border-border bg-surface focus:outline-none sm:rounded-cards`}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <h2 id={titleId} className="text-body-lg font-medium text-text">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
