import { useState } from 'react';

const SIZE_MAP = {
  xs: {
    box: 'h-4 w-4 rounded-[4px] p-[1.5px]',
    fallback: 'h-4 w-4 rounded-[4px] text-[9px]',
    flag: 'h-4 w-4 rounded-full',
  },
  sm: {
    box: 'h-5 w-5 rounded-[5px] p-[1.5px]',
    fallback: 'h-5 w-5 rounded-[5px] text-[10px]',
    flag: 'h-5 w-5 rounded-full',
  },
  28: {
    box: 'h-7 w-7 rounded-[7px] p-[2px]',
    fallback: 'h-7 w-7 rounded-[7px] text-[11px]',
    flag: 'h-7 w-7 rounded-full',
  },
  md: {
    box: 'h-9 w-9 rounded-[8px] p-[2px]',
    fallback: 'h-9 w-9 rounded-[8px] text-xs',
    flag: 'h-9 w-9 rounded-full',
  },
  lg: {
    box: 'h-11 w-11 rounded-[10px] p-[2.5px]',
    fallback: 'h-11 w-11 rounded-[10px] text-sm',
    flag: 'h-11 w-11 rounded-full',
  },
};

export default function StockLogo({ ticker, size = 'md', className = '' }) {
  const raw = String(ticker || '')
    .replace(/\.JK$/i, '')
    .trim()
    .toUpperCase();
  const isIhsg = raw === 'IHSG' || raw === '^JKSE' || raw === 'JKSE';
  const [failedTicker, setFailedTicker] = useState(null);
  const imgError = failedTicker === raw;
  const preset = SIZE_MAP[size] || SIZE_MAP.md;

  if (isIhsg) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface ${preset.flag} ${className}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-full w-full">
          <rect width="24" height="12" y="0" fill="#ef4444" />
          <rect width="24" height="12" y="12" fill="#ffffff" />
        </svg>
      </span>
    );
  }

  const monogram = raw.replace(/[^A-Z0-9]/g, '').slice(0, 2) || '–';

  if (!raw || imgError) {
    return (
      <span
        className={`num inline-flex shrink-0 select-none items-center justify-center border border-border bg-surface-2 font-bold tracking-tight text-text ${preset.fallback} ${className}`}
        aria-hidden="true"
      >
        {monogram}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-[#ffffff] ${preset.box} ${className}`}
      aria-hidden="true"
    >
      <img
        src={`https://assets.stockbit.com/logos/companies/${raw}.png`}
        alt=""
        loading="lazy"
        onError={() => setFailedTicker(raw)}
        className="h-full w-full rounded-[inherit] object-contain"
      />
    </span>
  );
}

