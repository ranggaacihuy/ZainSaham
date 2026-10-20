import { ExternalLink } from 'lucide-react';
import { Modal } from './ui';
import { dateTime } from '../lib/format';

/** Modal baca berita. Data berasal dari list (tidak ada endpoint detail berita). */
export default function NewsModal({ news, onClose }) {
  const paragraphs = (news?.content || '')
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Modal open={Boolean(news)} onClose={onClose} title="Berita" size="lg">
      {news && (
        <article>
          <p className="text-xs text-text-muted">
            {[news.ticker, news.source, dateTime(news.published_at)].filter(Boolean).join(' · ')}
          </p>
          <h3 className="mt-2 text-base font-semibold text-text">{news.title}</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-text">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p className="text-text-muted">Isi berita tidak tersedia.</p>
            )}
          </div>
          {news.source_url && (
            <a
              href={news.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              Buka di {news.source || 'sumber asli'}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </article>
      )}
    </Modal>
  );
}
