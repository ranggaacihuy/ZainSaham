export default function Sparkline({
  values = [],
  width = 96,
  height = 28,
  strokeWidth = 1.5,
  showArea = false,
  className = '',
}) {
  const points = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (points.length < 2) {
    return <span className={`inline-block text-xs text-text-muted ${className}`} style={{ width }}>–</span>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coordsList = points.map((v, i) => [
    (i * step).toFixed(1),
    (height - 4 - ((v - min) / range) * (height - 8)).toFixed(1),
  ]);
  const coords = coordsList.map(([x, y]) => `${x},${y}`).join(' ');
  const areaCoords = `0,${height} ${coords} ${width},${height}`;
  const rising = points[points.length - 1] >= points[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`${rising ? 'text-up' : 'text-down'} ${className}`}
      aria-hidden="true"
    >
      {showArea && <polygon points={areaCoords} fill="currentColor" fillOpacity="0.08" />}
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
