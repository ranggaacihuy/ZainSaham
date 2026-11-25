import { Check, Circle, AlertCircle } from 'lucide-react';

const WEAK_PASSWORD_PATTERNS = [
  '12345678',
  'password',
  'qwerty',
  'admin123',
  'zainsaham',
  'letmein',
  'welcome',
];

export function validatePassword(password = '') {
  const value = String(password);
  const length = Array.from(value).length;
  const lower = value.toLowerCase();

  const hasLength = length >= 8 && length <= 72;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(value);
  const hasSpace = /\s/.test(value);
  const hasRepeat = /(.)\1{3,}/.test(value);
  const hasWeakPattern = WEAK_PASSWORD_PATTERNS.some((p) => lower.includes(p));
  const isUnique = value.length > 0 && !hasSpace && !hasRepeat && !hasWeakPattern;

  const rules = [
  {
    id: 'length',
    label: 'Minimal 8 karakter',
    passed: hasLength,
  },
  {
    id: 'letters',
    label: 'Huruf besar & kecil (A–Z, a–z)',
    passed: hasUpper && hasLower,
  },
  {
    id: 'digit',
    label: 'Mengandung angka (0–9)',
    passed: hasDigit,
  },
  {
    id: 'symbol',
    label: 'Mengandung simbol (!@#$%^&*)',
    passed: hasSymbol,
  },
];

  let errorMessage = '';
  if (length < 8) {
    errorMessage = 'Kata sandi minimal 8 karakter.';
  } else if (length > 72) {
    errorMessage = 'Kata sandi maksimal 72 karakter.';
  } else if (hasSpace) {
    errorMessage = 'Kata sandi tidak boleh mengandung spasi.';
  } else if (hasRepeat) {
    errorMessage = 'Tidak boleh mengulang karakter sama 4 kali berturut-turut.';
  } else if (!hasUpper || !hasLower || !hasDigit || !hasSymbol) {
    errorMessage = 'Wajib mengandung huruf besar, huruf kecil, angka, dan simbol (contoh: R4ngga17!).';
  } else if (hasWeakPattern) {
    errorMessage = 'Kata sandi terlalu umum dan mudah ditebak.';
  }

  const isValid = rules.every((r) => r.passed);
  const passedCount = rules.filter((r) => r.passed).length;

  let level = 0;
  if (value.length > 0) {
    if (isValid) level = 3;
    else if (passedCount >= 4 && !hasWeakPattern && !hasSpace) level = 2;
    else level = 1;
  }

  return { rules, isValid, errorMessage, level, hasSpace, hasRepeat, hasWeakPattern };
}

const LEVEL_META = {
  1: { label: 'Lemah', textClass: 'text-rose-500', barClass: 'bg-rose-500' },
  2: { label: 'Sedang', textClass: 'text-amber-500', barClass: 'bg-amber-500' },
  3: { label: 'Kuat', textClass: 'text-emerald-500', barClass: 'bg-emerald-500' },
};

export default function PasswordStrength({ password = '' }) {
  if (!password) return null;

  const { rules, isValid, level, hasSpace, hasRepeat, hasWeakPattern } = validatePassword(password);
  const meta = LEVEL_META[level] || LEVEL_META[1];

  let specificWarning = '';
  if (hasSpace) specificWarning = 'Hapus spasi dari kata sandi.';
  else if (hasWeakPattern) specificWarning = 'Hindari pola umum seperti 12345678, qwerty, atau password.';
  else if (hasRepeat) specificWarning = 'Hindari 4 karakter yang sama berturut-turut (mis. 1111 atau aaaa).';

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2/60 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-text-muted">Kekuatan kata sandi</span>
        <span className={`font-medium ${meta.textClass}`}>{meta.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-1.5 rounded-full transition-colors duration-200 ${
              level >= step ? meta.barClass : 'bg-border'
            }`}
          />
        ))}
      </div>

      {specificWarning && (
        <div className="flex items-start gap-1.5 rounded-md bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-500">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{specificWarning}</span>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-1 pt-0.5 text-[11px] sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 transition-colors ${
              rule.passed ? 'text-emerald-500' : 'text-text-muted'
            }`}
          >
            {rule.passed ? (
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2} aria-hidden="true" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>

      {!isValid && (
        <p className="border-t border-border/70 pt-1.5 text-[11px] text-text-muted">
          Contoh kata sandi kuat: <span className="num font-medium text-text">Z41nS4ham_!</span>
        </p>
      )}
    </div>
  );
}