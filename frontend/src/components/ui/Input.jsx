import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const controlClass =
  'w-full rounded-lg border border-border bg-bg text-sm text-text placeholder:text-text-muted ' +
  'transition-colors duration-150 hover:border-text-muted/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ' +
  'disabled:opacity-50';

export const Input = forwardRef(function Input({ icon: Icon, className = '', wrapperClassName = '', ...props }, ref) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
      )}
      <input ref={ref} className={`${controlClass} h-9 ${Icon ? 'pl-9' : 'pl-3'} pr-3 ${className}`} {...props} />
    </div>
  );
});

export const Select = forwardRef(function Select({ className = '', wrapperClassName = '', children, ...props }, ref) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select ref={ref} className={`${controlClass} h-9 appearance-none pl-3 pr-9 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`${controlClass} resize-none px-3 py-2 ${className}`} {...props} />;
});

export function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-down">{error}</p>
      ) : (
        hint && <p className="text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}

export default Input;

