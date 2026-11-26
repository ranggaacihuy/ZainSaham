import { Link } from 'react-router-dom';
import { Logo } from './ui/Logo';
import AuthChartBackground from './AuthChartBackground';

const CURRENT_YEAR = new Date().getFullYear();

export default function AuthLayout({ eyebrow, title, description, switchText, switchLabel, switchTo, children }) {
  return (
    <div className="min-h-screen bg-bg p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4">
      {/* Kolom form */}
      <div className="flex min-h-[calc(100vh-1.5rem)] flex-col rounded-images bg-surface px-6 py-6 shadow-subtle sm:min-h-[calc(100vh-2rem)] sm:px-10 sm:py-8 xl:px-16">
        <header className="flex items-center justify-between gap-4">
          <Link to="/login" aria-label="ZainSaham" className="rounded-buttons focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris">
            <Logo />
          </Link>
          {switchTo && (
            <Link
              to={switchTo}
              className="inline-flex h-9 items-center rounded-buttons border border-border px-4 text-sm text-text transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris"
            >
              {switchLabel}
            </Link>
          )}
        </header>

        {/* Ilustrasi ringkas untuk layar kecil */}
        <div className="relative mt-6 h-36 overflow-hidden rounded-images bg-obsidian sm:h-44 lg:hidden" aria-hidden="true">
          <AuthChartBackground accent="monochrome" compact />
        </div>

        <main className="mx-auto flex w-full max-w-100 flex-1 flex-col justify-center py-10 lg:py-16">
          {eyebrow && (
            <span className="mb-6 inline-flex h-7 w-fit items-center rounded-badges bg-accent px-3 text-micro font-medium text-accent-ink">
              {eyebrow}
            </span>
          )}
          <h1 className="text-heading font-medium text-text sm:text-heading-lg">{title}</h1>
          {description && <p className="mt-4 text-body-sm text-text-muted">{description}</p>}

          <div className="mt-10">{children}</div>

          {switchTo && (
            <p className="mt-8 text-caption text-text-muted">
              {switchText}{' '}
              <Link
                to={switchTo}
                className="font-medium text-text underline decoration-border-strong underline-offset-4 transition-colors duration-150 hover:decoration-text"
              >
                {switchLabel}
              </Link>
            </p>
          )}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-micro text-text-muted">
          <span>© {CURRENT_YEAR} ZainSaham</span>
          <span>Analisis saham Indonesia untuk investor ritel</span>
        </footer>
      </div>

      {/* Panel ilustrasi (desktop) */}
      <aside className="relative hidden overflow-hidden rounded-images bg-obsidian lg:block" aria-hidden="true">
        <AuthChartBackground accent="monochrome" />
        <div className="relative z-10 flex h-full flex-col items-center px-10 pt-20 text-center xl:pt-24">
          <span className="inline-flex h-7 items-center rounded-badges border border-pure/20 bg-obsidian/80 px-3 text-micro font-medium text-pure backdrop-blur-sm">
            Saham Bursa Efek Indonesia
          </span>
          <p className="mt-6 max-w-xl text-heading-lg font-medium text-pure xl:text-display">
            Membaca pasar dengan kepala dingin.
          </p>
          <p className="mt-5 max-w-md text-body text-cloud/85">
            Data harga, fundamental, dan analisis AI dalam satu ruang kerja yang tenang.
          </p>
        </div>
      </aside>
    </div>
  );
}