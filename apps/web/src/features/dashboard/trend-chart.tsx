import type { DashboardDTO } from '@sentinel/shared';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Panel } from '../../components/ui/layout';
import { useT } from '../../i18n';

type Point = DashboardDTO['trend'][number];

const HEIGHT = 216;
const PAD = { top: 10, right: 12, bottom: 26, left: 32 };

/** Width of an element, kept current with a ResizeObserver. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round axis maximum and step: 1, 2 or 5 times a power of ten. */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? raw;
  const safeStep = Math.max(1, step);
  return { top: Math.ceil(max / safeStep) * safeStep, step: safeStep };
}

/** Trend days are calendar days already counted in the organization's time zone, so they are formatted as plain dates. */
function useDayFormat() {
  const { locale } = useT();
  return useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short' });
    const long = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
    const parse = (day: string) => new Date(`${day}T00:00:00Z`);
    return { short: (day: string) => short.format(parse(day)), long: (day: string) => long.format(parse(day)) };
  }, [locale]);
}

function LegendKey({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-0.5 w-3 rounded-full ${className}`} />;
}

export function TrendChart({ trend }: { trend: DashboardDTO['trend'] }) {
  const { t, number, timeZone } = useT();
  const format = useDayFormat();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');

  const totals = trend.reduce(
    (sum, point) => ({ created: sum.created + point.created, resolved: sum.resolved + point.resolved }),
    { created: 0, resolved: 0 },
  );
  const { top, step } = niceScale(Math.max(0, ...trend.map((point) => Math.max(point.created, point.resolved))));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const n = trend.length;
  const x = (index: number) => PAD.left + (n <= 1 ? plotW / 2 : (index / (n - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const path = (key: 'created' | 'resolved') =>
    trend
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`)
      .join(' ');

  const yTicks: number[] = [];
  for (let value = 0; value <= top; value += step) yTicks.push(value);
  const labelCount = Math.min(n, Math.max(2, Math.floor(plotW / 96)));
  const xTicks =
    n <= 1
      ? [0]
      : [
          ...new Set(
            Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, labelCount - 1))),
          ),
        ];

  const activePoint: Point | undefined = active === null ? undefined : trend[active];
  const describe = (point: Point) =>
    `${format.long(point.date)}: ${t('dashboard.trend.created')} ${number(point.created)}, ${t('dashboard.trend.resolved')} ${number(point.resolved)}`;

  const onPointer = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = plotW === 0 ? 0 : (event.clientX - box.left) / plotW;
    setActive(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = active === null ? n - 1 : Math.min(n - 1, active + 1);
    else if (event.key === 'ArrowLeft') next = active === null ? n - 1 : Math.max(0, active - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = n - 1;
    else if (event.key === 'Escape') {
      setActive(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    const point = trend[next];
    if (point) setAnnounce(describe(point));
  };

  // The tooltip sits beside the crosshair, never over the day it describes.
  const TOOLTIP_W = 160;
  const tooltipLeft =
    active === null
      ? 0
      : x(active) + 12 + TOOLTIP_W <= width
        ? x(active) + 12
        : Math.max(0, x(active) - 12 - TOOLTIP_W);

  return (
    <Panel
      title={t('dashboard.trend.title')}
      actions={
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="flex items-center gap-1.5">
            <LegendKey className="bg-accent" />
            {t('dashboard.trend.created')}
            <span className="text-ink-3 tabular-nums">{number(totals.created)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <LegendKey className="bg-ink-3" />
            {t('dashboard.trend.resolved')}
            <span className="text-ink-3 tabular-nums">{number(totals.resolved)}</span>
          </li>
        </ul>
      }
    >
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs text-ink-3">{t('dashboard.trend.description', { timeZone })}</p>
        <div
          ref={ref}
          role="img"
          tabIndex={0}
          aria-label={t('dashboard.trend.summary', {
            created: number(totals.created),
            resolved: number(totals.resolved),
          })}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="relative mt-2 rounded-sm"
          style={{ height: HEIGHT }}
        >
          {width > 0 && (
            <svg width={width} height={HEIGHT} className="block overflow-visible" aria-hidden>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="stroke-line"
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={PAD.left - 8}
                    y={y(tick)}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-ink-3 text-2xs tabular-nums"
                  >
                    {number(tick)}
                  </text>
                </g>
              ))}
              {xTicks.map((index) => {
                const point = trend[index];
                if (!point) return null;
                const anchor = index === 0 && n > 1 ? 'start' : index === n - 1 && n > 1 ? 'end' : 'middle';
                return (
                  <text
                    key={point.date}
                    x={x(index)}
                    y={HEIGHT - 8}
                    textAnchor={anchor}
                    className="fill-ink-3 text-2xs tabular-nums"
                  >
                    {format.short(point.date)}
                  </text>
                );
              })}

              {activePoint && active !== null && (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  className="stroke-line-strong"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              )}

              <path
                d={path('resolved')}
                fill="none"
                className="stroke-ink-3"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={path('created')}
                fill="none"
                className="stroke-accent"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {(activePoint && active !== null ? [active] : n > 0 ? [n - 1] : []).map((index) => {
                const point = trend[index];
                if (!point) return null;
                return (
                  <g key={index}>
                    <circle
                      cx={x(index)}
                      cy={y(point.resolved)}
                      r={4}
                      className="fill-ink-3 stroke-surface"
                      strokeWidth={2}
                    />
                    <circle
                      cx={x(index)}
                      cy={y(point.created)}
                      r={4}
                      className="fill-accent stroke-surface"
                      strokeWidth={2}
                    />
                  </g>
                );
              })}

              <rect
                x={PAD.left}
                y={PAD.top}
                width={plotW}
                height={plotH}
                fill="transparent"
                onPointerMove={onPointer}
                onPointerDown={onPointer}
                onPointerLeave={() => setActive(null)}
              />
            </svg>
          )}

          {activePoint && active !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 z-10 w-40 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-pop"
              style={{ left: tooltipLeft }}
            >
              <p className="font-medium text-ink">{format.long(activePoint.date)}</p>
              <p className="mt-1 flex items-center gap-2 text-ink-2">
                <LegendKey className="bg-accent" />
                <span className="flex-1">{t('dashboard.trend.created')}</span>
                <span className="font-medium text-ink tabular-nums">{number(activePoint.created)}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-ink-2">
                <LegendKey className="bg-ink-3" />
                <span className="flex-1">{t('dashboard.trend.resolved')}</span>
                <span className="font-medium text-ink tabular-nums">{number(activePoint.resolved)}</span>
              </p>
            </div>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        <table className="sr-only">
          <caption>{t('dashboard.trend.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('dashboard.trend.day')}</th>
              <th scope="col">{t('dashboard.trend.created')}</th>
              <th scope="col">{t('dashboard.trend.resolved')}</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((point) => (
              <tr key={point.date}>
                <th scope="row">{format.long(point.date)}</th>
                <td>{number(point.created)}</td>
                <td>{number(point.resolved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
