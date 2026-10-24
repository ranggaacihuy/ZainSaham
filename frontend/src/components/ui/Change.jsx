import { pct, signed, toneOf } from '../../lib/format';

const toneText = { up: 'text-up', down: 'text-down', neutral: 'text-text-muted' };

export function Change({ pctValue, value, className = '', showValue = false }) {
  const tone = toneOf(pctValue ?? value);
  return (
    <span className={`num ${toneText[tone]} ${className}`}>
      {showValue && value !== null && value !== undefined && <span>{signed(value)} </span>}
      {showValue ? `(${pct(pctValue)})` : pct(pctValue)}
    </span>
  );
}
