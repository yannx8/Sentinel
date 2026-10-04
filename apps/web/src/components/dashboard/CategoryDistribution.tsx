import { useI18n } from '../../i18n';
import { CATEGORY_LABELS } from '../../constants';

interface CategoryDistributionProps {
  data: Array<{ category: string; _count: number }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  LIGHTING: '#f59e0b',
  PLUMBING: '#3b82f6',
  SECURITY: '#ef4444',
  FURNITURE: '#8b5cf6',
  ROAD: '#6b7280',
  EQUIPMENT: '#10b981',
  HVAC: '#06b6d4',
  OTHER: '#9ca3af'
};

/**
 * Vertical bar chart showing incident counts per category.
 * Categories are sorted descending by count so the most frequent
 * appears at the top of the list.
 */
export function CategoryDistribution({ data }: CategoryDistributionProps) {
  const t = useI18n((s) => s.t);
  const total = data.reduce((sum, d) => sum + d._count, 0);

  if (total === 0) {
    return (
      <div className="empty-compact" style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
        {t('dashboard.noData')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.sort((a, b) => b._count - a._count).map((d) => {
        const pct = Math.round((d._count / total) * 100);
        const color = CATEGORY_COLORS[d.category] || '#9ca3af';
        return (
          <div key={d.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#374151' }}>
                  {CATEGORY_LABELS[d.category] || d.category}
                </span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                  {d._count} ({pct}%)
                </span>
              </div>
              <div style={{ height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
