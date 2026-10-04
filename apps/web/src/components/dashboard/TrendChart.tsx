import { useI18n } from '../../i18n';

interface TrendChartProps {
  data: Array<{ date: string; count: number }>;
}

/**
 * Bar chart showing incident creation counts over time.
 * Data is expected as daily aggregates from the backend.
 * Each bar is normalized to the maximum count in the dataset.
 */
export function TrendChart({ data }: TrendChartProps) {
  const t = useI18n((s) => s.t);
  // Default max to 1 to avoid division by zero when dataset is empty.
  const max = Math.max(...data.map((d) => d.count), 1);

  if (data.length === 0) {
    return (
      <div className="empty-compact" style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
        {t('dashboard.noData')}
      </div>
    );
  }

  const barWidth = Math.floor(100 / data.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, padding: '0 4px' }}>
        {data.map((d, i) => {
          const height = max > 0 ? Math.max(2, (d.count / max) * 100) : 2;
          return (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2
              }}
            >
              <span style={{ fontSize: 9, color: '#9ca3af' }}>{d.count}</span>
              <div
                style={{
                  width: '100%',
                  maxWidth: 24,
                  height: `${height}%`,
                  backgroundColor: '#2d8a5e',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s ease'
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '0 4px' }}>
        {data.map((d) => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: '#9ca3af' }}>
              {/* Slice to "MM-DD" portion of the ISO date string for compact labels */}
              {d.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
