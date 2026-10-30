import { Badge } from './ui';
import MarkdownText from './MarkdownText';
import StockLogo from './StockLogo';
import { analysisTypeLabel } from '../api/ai';
import { dateTime } from '../lib/format';

export default function AnalysisResult({ analysis, ticker, companyName }) {
  return (
    <article>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4 sm:px-6">
        {ticker && <StockLogo ticker={ticker} size="sm" />}
        <h2 className="num text-base font-semibold tracking-tight text-text">{ticker}</h2>
        <Badge tone="iris">{analysisTypeLabel(analysis.session?.analysis_type)}</Badge>
        {companyName && <span className="hidden truncate text-sm text-text-muted sm:inline">· {companyName}</span>}
        <p className="num w-full text-xs text-text-muted">
          {[analysis.model_name && `Model ${analysis.model_name}`, dateTime(analysis.created_at)].filter(Boolean).join(' · ')}
        </p>
      </header>
      <div className="px-5 py-5 sm:px-6">
        <MarkdownText text={analysis.result} />
      </div>
      <p className="border-t border-border bg-bg/30 px-5 py-3 text-xs text-text-muted sm:px-6">
        Bukan saran investasi. Gunakan sebagai bahan pertimbangan dan lakukan riset sendiri.
      </p>
    </article>
  );
}
