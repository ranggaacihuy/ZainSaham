import { useEffect, useRef, useState } from 'react';
import { chartColors, createThemedChart } from '../lib/chart';

export default function useChart(setup) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    const colors = chartColors();
    const chart = createThemedChart(containerRef.current, colors);

    chart.subscribeCrosshairMove((param) => {
      setHoverIndex(param.time === undefined || param.logical === undefined ? null : Math.round(param.logical));
    });

    apiRef.current = { chart, colors, ...setup(chart, colors) };

    return () => {
      apiRef.current = null;
      chart.remove();
    };
  }, [setup]);

  return { containerRef, apiRef, hoverIndex };
}
