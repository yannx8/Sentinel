import { PriorityBadge } from '../shared/PriorityBadge';

/**
 * Horizontal bar chart showing incident counts per priority level.
 * Uses a fixed color map for visual consistency across the dashboard.
 */
export function PriorityDistribution({ data }: { data: any[] }) {
  // Default to 1 to avoid division by zero when dataset is empty.
  const total = data.reduce((s: number, x: any) => s + x._count, 0) || 1;
  const colorMap: Record<string, string> = {
    CRITICAL: '#d97070',
    HIGH: '#e0a263',
    MEDIUM: '#9b89c2',
    LOW: '#79b8a4'
  };
  return (
    <div style={{ padding: '8px 19px 16px' }}>
      {data.map((p: any) => (
        <div key={p.priority} className="status-bar-row">
          <PriorityBadge value={p.priority} />
          <div className="status-bar-track">
            <div className="status-bar-fill" style={{ width: `${(p._count / total) * 100}%`, background: colorMap[p.priority] || '#9b89c2' }} />
          </div>
          <span className="status-bar-count">{p._count}</span>
        </div>
      ))}
    </div>
  );
}
