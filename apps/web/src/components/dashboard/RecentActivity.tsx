import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { timeAgo, useTimeAgo } from '../../lib/utils';

/**
 * Lists the 5 most recent incidents with status-based color coding.
 * Used as a secondary widget on the admin dashboard.
 */
export function RecentActivity() {
  const [events, setEvents] = useState<any[]>([]);
  const t = useI18n((s) => s.t);
  const timeAgoFn = useTimeAgo();
  useEffect(() => {
    api<any>('/incidents?limit=5')
      .then((d) => {
        const items = d.items || d;
        setEvents(items.slice(0, 5));
      })
      .catch((err) => console.error('Failed to load recent activity:', err));
  }, []);

  // Status-to-color mapping kept inline for quick reference during maintenance.
  const symbolColors: Record<string, string> = {
    NEW: '#e0a263',
    ASSIGNED: '#9b89c2',
    IN_PROGRESS: '#059669',
    RESOLVED: '#6db3e0',
    CLOSED: '#aeb7b9'
  };

  return (
    <div style={{ padding: '4px 11px 10px' }}>
      {events.length === 0 ? (
        <div className="empty-state empty-compact">
          <div className="empty-title">{t('dashboard.emptyActivity')}</div>
        </div>
      ) : (
        events.map((e: any) => (
          <div key={e.id} className="activity-row">
            <div className="activity-symbol" style={{ background: `${symbolColors[e.status] || '#059669'}20`, color: symbolColors[e.status] || '#059669' }}>
              <ClipboardList size={13} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="activity-copy-title">{e.title}</div>
              <div className="activity-copy-meta">{e.site?.name} &middot; {t(`incidentStatuses.${e.status}` as any) || e.status}</div>
            </div>
            <span className="activity-time">{timeAgoFn(e.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}
