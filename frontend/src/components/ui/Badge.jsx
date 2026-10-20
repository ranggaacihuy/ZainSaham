const tones = {
  neutral: 'bg-surface-2 text-text-muted',
  up: 'bg-up/10 text-up',
  down: 'bg-down/10 text-down',
  warn: 'bg-warn/10 text-warn',
};

/** Satu-satunya gaya badge. */
export function Badge({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;

