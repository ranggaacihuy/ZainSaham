const tones = {
  neutral: 'bg-surface-2 text-text-muted',
  iris: 'border border-iris/30 bg-iris/10 text-iris',
  dark: 'bg-accent text-accent-ink',
  up: 'bg-up/10 text-up',
  down: 'bg-down/10 text-down',
  warn: 'bg-warn/10 text-warn',
};

export function Badge({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-badges px-2.5 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
