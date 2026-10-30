import { useEffect, useRef, useState } from 'react';
import { chartColors, chartThemeOptions, createThemedChart } from '../lib/chart';

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

    const instance = setup(chart, colors);
    apiRef.current = { chart, colors, ...instance };

    const onThemeChange = () => {
      if (!apiRef.current) return;
      const nextColors = chartColors();
      apiRef.current.colors = nextColors;
      chart.applyOptions(chartThemeOptions(nextColors));
      apiRef.current.applyTheme?.(nextColors);
    };

    window.addEventListener('zainsaham:theme-change', onThemeChange);

    return () => {
      window.removeEventListener('zainsaham:theme-change', onThemeChange);
      apiRef.current = null;
      chart.remove();
    };
  }, [setup]);

  return { containerRef, apiRef, hoverIndex };
}
