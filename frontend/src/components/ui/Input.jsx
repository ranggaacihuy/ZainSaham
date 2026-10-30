import { forwardRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';

// Surface: --color-pure (#ffffff) in Light Mode, --color-obsidian (#0f1011) in Dark Mode
// Focus ring: micro-accent --color-iris (#4b49aa / #847dff) without glow shadow
const controlClass =
  'w-full rounded-inputs border border-border bg-input text-sm text-text placeholder:text-text-muted ' +
  'transition-colors duration-150 hover:border-border-strong ' +
  'focus:outline-none focus:border-iris focus:ring-1 focus:ring-iris focus-visible:outline-none ' +
  'disabled:opacity-50';

export const Input = forwardRef(function Input({ icon: Icon, type, className = '', wrapperClassName = '', ...props }, ref) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={`relative ${wrapperClassName}`}>
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
      <input
        ref={ref}
        type={inputType}
        className={`${controlClass} h-10 ${Icon ? 'pl-10' : 'pl-3.5'} ${isPassword ? 'pr-10' : 'pr-3.5'} ${className}`}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors duration-150 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
});

export const Select = forwardRef(function Select({ className = '', wrapperClassName = '', children, ...props }, ref) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select ref={ref} className={`${controlClass} h-10 appearance-none pl-3.5 pr-10 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`${controlClass} resize-none px-3.5 py-2.5 ${className}`} {...props} />;
});

export function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="space-y-2">
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
