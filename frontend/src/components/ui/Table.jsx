/**
 * Satu-satunya gaya tabel: header 12px muted, baris 44px, garis tipis, tanpa zebra.
 * Bungkus dengan <TableWrap> agar tabel bisa di-scroll di dalam wadahnya.
 */
export function TableWrap({ children, className = '', maxHeight }) {
  return (
    <div className={`overflow-x-auto ${maxHeight ? 'overflow-y-auto' : ''} ${className}`} style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

export function Table({ children, className = '' }) {
  return <table className={`w-full border-collapse text-left text-sm ${className}`}>{children}</table>;
}

export function THead({ children }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children, className = '', onClick, ...props }) {
  const interactive = onClick ? 'cursor-pointer hover:bg-surface-2 transition-colors duration-150' : '';
  return (
    <tr className={`${interactive} ${className}`} onClick={onClick} {...props}>
      {children}
    </tr>
  );
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function Th({ children, align = 'left', className = '', ...props }) {
  return (
    <th
      scope="col"
      className={`sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-border bg-surface px-4 text-xs font-medium text-text-muted ${alignClass[align]} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', num = false, className = '', ...props }) {
  return (
    <td
      className={`h-11 whitespace-nowrap border-b border-border px-4 ${alignClass[num ? 'right' : align]} ${num ? 'num' : ''} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

