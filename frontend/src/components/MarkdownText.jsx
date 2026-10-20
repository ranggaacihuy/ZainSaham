import { Fragment } from 'react';

/**
 * Renderer markdown kecil dan aman (tanpa dangerouslySetInnerHTML).
 * Mendukung: paragraf, heading (#), daftar (-, *, •, 1.), **tebal**, *miring*, `kode`.
 * Struktur lain ditampilkan apa adanya sebagai teks.
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;

function renderInline(text, keyPrefix) {
  const parts = text.split(INLINE_PATTERN).filter((p) => p !== '');
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <strong key={key} className="font-semibold text-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function parseBlocks(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      return;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet || ordered)[1]);
      return;
    }

    // Baris lanjutan dari item daftar (diindentasi).
    if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return blocks;
}

export default function MarkdownText({ text, className = '' }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return <p className="text-sm text-text-muted">Tidak ada isi.</p>;

  return (
    <div className={`space-y-3 text-sm leading-6 text-text ${className}`}>
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        if (block.type === 'h') {
          return (
            <h3 key={key} className={`${block.level <= 2 ? 'text-base' : 'text-sm'} pt-1 font-semibold text-text`}>
              {renderInline(block.text, key)}
            </h3>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const ListTag = block.type;
          return (
            <ListTag key={key} className={`space-y-1 pl-5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-text-muted`}>
              {block.items.map((item, j) => (
                <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={key}>
            {block.lines.map((line, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 && <br />}
                {renderInline(line, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

