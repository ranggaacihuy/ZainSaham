import { Asterisk } from 'lucide-react';

export function Logo({ className = '', inverted = false }) {
  const color = inverted ? 'text-pure' : 'text-text';
  return (
    <span className={`inline-flex items-center gap-1.5 ${color} ${className}`}>
      <Asterisk className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      <span className="text-base font-medium uppercase tracking-[0.04em]">ZainSaham</span>
    </span>
  );
}
