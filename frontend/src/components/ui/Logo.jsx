import { useTheme } from '../../context/ThemeContext';
import logoDark from '../../assets/logo-dark.png';
import logoLight from '../../assets/logo-light.png';

export function Logo({ className = '', inverted = false }) {
  const { theme } = useTheme();
  const isDark = inverted || theme === 'dark';
  const color = inverted ? 'text-pure' : 'text-text';

  return (
    <span className={`inline-flex items-center gap-2 ${color} ${className}`}>
      <img
        src={isDark ? logoDark : logoLight}
        alt=""
        aria-hidden="true"
        className="h-5 w-auto shrink-0 object-contain"
      />
      <span className="text-base font-medium uppercase tracking-[0.04em]">ZainSaham</span>
    </span>
  );
}
