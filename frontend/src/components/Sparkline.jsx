/** Sparkline kecil. Warna mengikuti arah harga di jendela data (naik = up, turun = down). */
export default function Sparkline({ values = [], width = 96, height = 28, className = '' }) {
  const points = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (points.length < 2) {
    return <span className={`inline-block text-xs text-text-muted ${className}`} style={{ width }}>–</span>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const rising = points[points.length - 1] >= points[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`${rising ? 'text-up' : 'text-down'} ${className}`}
      aria-hidden="true"
    >
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

