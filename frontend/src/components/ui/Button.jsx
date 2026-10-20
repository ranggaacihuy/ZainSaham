import { forwardRef } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-border bg-surface-2 text-text hover:bg-border',
  ghost: 'text-text-muted hover:bg-surface-2 hover:text-text',
  danger: 'border border-down/40 text-down hover:bg-down/10',
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  icon: 'h-8 w-8 text-sm',
};

export const Button = forwardRef(function Button(
  { as: Component = 'button', variant = 'secondary', size = 'md', icon: Icon, className = '', children, ...props },
  ref,
) {
  const extra = Component === 'button' && !props.type ? { type: 'button' } : {};
  return (
    <Component ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...extra} {...props}>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </Component>
  );
});

export default Button;

