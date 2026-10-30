import { forwardRef } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-buttons font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover disabled:border disabled:border-border disabled:bg-surface-2 disabled:text-text-muted disabled:opacity-100',
  secondary: 'border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2',
  outline: 'border border-border-strong bg-transparent text-text hover:bg-surface-2',
  ghost: 'text-text-muted hover:bg-surface-2 hover:text-text',
  danger: 'border border-down/40 bg-down/10 text-down hover:bg-down/15',
};

const sizes = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 rounded-large-buttons px-6 text-sm',
  icon: 'h-8 w-8 text-sm',
};

export const Button = forwardRef(function Button(
  { as: Component = 'button', variant = 'secondary', size = 'md', icon: Icon, className = '', children, ...props },
  ref,
) {
  const extra = Component === 'button' && !props.type ? { type: 'button' } : {};
  return (
    <Component
      ref={ref}
      className={`${base} ${variants[variant] || variants.secondary} ${sizes[size] || sizes.md} ${className}`}
      {...extra}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </Component>
  );
});
