import type { SVGProps } from 'react';

export type GlyphName =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'new'
  | 'assigned'
  | 'progress'
  | 'resolved'
  | 'closed';

const paths: Record<GlyphName, React.ReactNode> = {
  critical: <path d="M6 1.4 11.2 10.6H.8z" fill="currentColor" />,
  high: <rect x="2" y="2" width="8" height="8" rx="1.2" fill="currentColor" />,
  medium: <circle cx="6" cy="6" r="4.6" fill="currentColor" />,
  low: <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  new: <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 1.8" />,
  assigned: (
    <>
      <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="1.6" fill="currentColor" />
    </>
  ),
  progress: (
    <>
      <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 1.6a4.4 4.4 0 0 1 0 8.8z" fill="currentColor" />
    </>
  ),
  resolved: (
    <>
      <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.9 6.1 5.4 7.6 8.2 4.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  closed: (
    <>
      <circle cx="6" cy="6" r="5" fill="currentColor" />
      <path d="M3.8 6.1 5.3 7.6 8.2 4.5" fill="none" stroke="var(--sunken)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

/** Decorative by default: pair it with a visible label or give it `aria-label`. */
export function Glyph({ name, size = 12, ...rest }: { name: GlyphName; size?: number } & SVGProps<SVGSVGElement>) {
  const labelled = rest['aria-label'] !== undefined;
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
