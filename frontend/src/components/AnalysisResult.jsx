import { Badge } from './ui';
import MarkdownText from './MarkdownText';
import { analysisTypeLabel } from '../api/ai';
import { dateTime } from '../lib/format';

/** Hasil analisis AI: teks apa adanya (markdown sederhana), model, waktu, dan satu baris disclaimer. */
export default function AnalysisResult({ analysis, ticker, companyName }) {
  return (
    <article>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-text">{ticker}</h2>
        <Badge>{analysisTypeLabel(analysis.session?.analysis_type)}</Badge>
        {companyName && <span className="hidden truncate text-sm text-text-muted sm:inline">{companyName}</span>}
        <p className="w-full text-xs text-text-muted">
          {[analysis.model_name && `Model ${analysis.model_name}`, dateTime(analysis.created_at)].filter(Boolean).join(' · ')}
        </p>
      </header>
      <div className="px-4 py-4 sm:px-5">
        <MarkdownText text={analysis.result} />
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-text-muted sm:px-5">
        Bukan saran investasi. Gunakan sebagai bahan pertimbangan dan lakukan riset sendiri.
      </p>
    </article>
  );
}

