import { StatusBadge } from '../shared/StatusBadge';
import { statusDotClass } from '../../constants';

/**
 * Horizontal bar chart showing incident counts per status.
 * Each bar's width is a percentage of the total.
 */
export function StatusDistribution({ data }: { data: any[] }) {
  // Default to 1 to avoid division by zero when dataset is empty.
  const total = data.reduce((s: number, x: any) => s + x._count, 0) || 1;
  return (
    <div style={{ padding: '8px 19px 16px' }}>
      {data.map((s: any) => (
        <div key={s.status} className="status-bar-row">
          <StatusBadge value={s.status} />
          <div className="status-bar-track">
            <div className={`status-bar-fill ${statusDotClass[s.status] || ''}`} style={{ width: `${(s._count / total) * 100}%` }} />
          </div>
          <span className="status-bar-count">{s._count}</span>
        </div>
      ))}
    </div>
  );
}
