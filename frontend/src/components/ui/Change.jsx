import { pct, signed, toneOf } from '../../lib/format';

const toneText = { up: 'text-up', down: 'text-down', neutral: 'text-text-muted' };
const tonePill = {
  up: 'bg-up/12 text-up',
  down: 'bg-down/12 text-down',
  neutral: 'bg-surface-2 text-text-muted',
};

export function Change({ pctValue, value, className = '', showValue = false, pill = false }) {
  const tone = toneOf(pctValue ?? value);
  if (pill) {
    return (
      <span
        className={`num inline-flex items-center rounded-badges px-2.5 py-0.5 text-xs font-medium ${tonePill[tone]} ${className}`}
      >
        {showValue && value !== null && value !== undefined && <span>{signed(value)}&nbsp;</span>}
        {showValue ? `(${pct(pctValue)})` : pct(pctValue)}
      </span>
    );
  }
  return (
    <span className={`num ${toneText[tone]} ${className}`}>
      {showValue && value !== null && value !== undefined && <span>{signed(value)} </span>}
      {showValue ? `(${pct(pctValue)})` : pct(pctValue)}
    </span>
  );
}
