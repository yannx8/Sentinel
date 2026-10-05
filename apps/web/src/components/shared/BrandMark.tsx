export function BrandMark({ className, size }: { className?: string; size?: number }) {
  const s = size || 20;
  return (
    <div className={className || 'brand-mark'} style={size ? { width: s, height: s, gap: Math.max(2, s * 0.12) } : undefined}>
      <span style={{ height: Math.round(s * 0.33), opacity: 0.65 }} />
      <span style={{ height: Math.round(s * 0.6), opacity: 1 }} />
      <span style={{ height: Math.round(s * 0.45), opacity: 0.85 }} />
    </div>
  );
}
