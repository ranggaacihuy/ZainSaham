import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, Table, TableWrap, THead, TBody, Tr, Th, Td } from './ui';
import useElementWidth from '../hooks/useElementWidth';
import { compact, date, idr, idrCompact, number } from '../lib/format';

const CHART_H = 200;
const AXIS_H = 20;
const LEFT_AXIS = 56;

const PERIOD_OPTIONS = [
  { value: 'quarterly', label: 'Kuartalan' },
  { value: 'annual', label: 'Tahunan' },
];

const ratio = (v, suffix = '') => (v === null || v === undefined ? '–' : `${number(v)}${suffix}`);

/**
 * Fundamental: grafik pendapatan vs laba bersih + tabel rasio.
 * `fundamentals` urut terbaru → lama (seperti dari backend).
 * `periodType`/`onTypeChange` hanya diberikan bila pola periode bisa dibedakan (lihat classifyPeriods).
 */
export default function FundamentalChart({ fundamentals = [], periodType, onTypeChange }) {
  const [expanded, setExpanded] = useState(null);
  const [chartRef, width] = useElementWidth(720);

  const chronological = [...fundamentals].reverse();
  const count = chronological.length;

  let maxVal = 0;
  let minVal = 0;
  chronological.forEach((f) => {
    [f.revenue, f.net_income].forEach((v) => {
      if (v !== null) {
        maxVal = Math.max(maxVal, v);
        minVal = Math.min(minVal, v);
      }
    });
  });
  const span = maxVal - minVal || 1;
  const top = maxVal + span * 0.08;
  const bottom = minVal < 0 ? minVal - span * 0.08 : 0;
  const getY = (v) => 8 + (1 - (v - bottom) / (top - bottom)) * (CHART_H - 16);
  const plotW = Math.max(40, width - LEFT_AXIS);
  const slot = count > 0 ? plotW / count : plotW;
  const barW = Math.max(3, Math.min(24, slot * 0.3));
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotW / 72))));
  const ticks = [top, (top + bottom) / 2, bottom].concat(bottom < 0 ? [0] : []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" />
              Pendapatan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-text-muted" aria-hidden="true" />
              Laba bersih
            </span>
          </div>
          {onTypeChange && (
            <Tabs
              variant="segmented"
              size="sm"
              label="Jenis periode"
              items={PERIOD_OPTIONS}
              value={periodType}
              onChange={onTypeChange}
            />
          )}
        </div>

        <div className="px-4 pb-3 pt-3"><div ref={chartRef} className="w-full min-w-0 overflow-hidden">
          {count === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">Tidak ada data untuk periode ini.</p>
          ) : (
            <svg
              width={width}
              height={CHART_H + AXIS_H}
              viewBox={`0 0 ${width} ${CHART_H + AXIS_H}`}
              className="block select-none"
              role="img"
              aria-label="Grafik pendapatan dan laba bersih"
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={LEFT_AXIS} x2={LEFT_AXIS + plotW} y1={getY(tick)} y2={getY(tick)} className="stroke-border" />
                  <text x={LEFT_AXIS - 8} y={getY(tick) + 4} textAnchor="end" className="num fill-text-muted" fontSize="12">
                    {compact(tick)}
                  </text>
                </g>
              ))}
              {chronological.map((f, i) => {
                const cx = LEFT_AXIS + slot * i + slot / 2;
                const y0 = getY(0);
                const bars = [
                  { value: f.revenue, x: cx - barW - 1, cls: 'fill-accent' },
                  { value: f.net_income, x: cx + 1, cls: f.net_income < 0 ? 'fill-down' : 'fill-text-muted' },
                ];
                return (
                  <g key={f.period || i}>
                    <title>{`${f.period}: pendapatan ${idrCompact(f.revenue)}, laba bersih ${idrCompact(f.net_income)}`}</title>
                    {bars.map((bar, j) =>
                      bar.value === null ? null : (
                        <rect
                          key={j}
                          x={bar.x}
                          y={Math.min(y0, getY(bar.value))}
                          width={barW}
                          height={Math.max(1, Math.abs(getY(bar.value) - y0))}
                          className={bar.cls}
                        />
                      ),
                    )}
                    {i % labelEvery === 0 && (
                      <text x={cx} y={CHART_H + AXIS_H - 4} textAnchor="middle" className="num fill-text-muted" fontSize="12">
                        {f.period}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Periode</Th>
                <Th align="right">Pendapatan</Th>
                <Th align="right">Laba bersih</Th>
                <Th align="right">EPS</Th>
                <Th align="right">ROE (%)</Th>
                <Th align="right">ROA (%)</Th>
                <Th align="right">DER</Th>
                <Th align="right">
                  <span className="sr-only">Rincian</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {fundamentals.map((f) => {
                const open = expanded === f.period;
                return (
                  <Fragment key={f.period}>
                    <Tr onClick={() => setExpanded(open ? null : f.period)} aria-expanded={open}>
                      <Td className="font-medium text-text">{f.period}</Td>
                      <Td num>{idrCompact(f.revenue)}</Td>
                      <Td num className={f.net_income < 0 ? 'text-down' : ''}>
                        {idrCompact(f.net_income)}
                      </Td>
                      <Td num>{idr(f.eps, { decimals: 2 })}</Td>
                      <Td num>{ratio(f.roe)}</Td>
                      <Td num>{ratio(f.roa)}</Td>
                      <Td num>{ratio(f.debt_to_equity, '×')}</Td>
                      <Td align="right" className="w-10 text-text-muted">
                        {open ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
                      </Td>
                    </Tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="border-b border-border bg-bg px-4 py-3">
                          <dl className="num grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
                            <div>
                              <dt className="text-xs text-text-muted">Total aset</dt>
                              <dd className="text-text">{idrCompact(f.total_assets)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-text-muted">Total liabilitas</dt>
                              <dd className="text-text">{idrCompact(f.total_liabilities)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-text-muted">Total ekuitas</dt>
                              <dd className="text-text">{idrCompact(f.total_equity)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-text-muted">Diperbarui</dt>
                              <dd className="text-text">{date(f.updated_at)}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      </div>
    </div>
  );
}
