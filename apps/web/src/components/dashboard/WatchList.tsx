import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { useTimeAgo } from '../../lib/utils';
import { categoryPriorityClass } from '../../constants';
import { Drawer } from '../drawer/IncidentDrawer';
import { Incident } from '../../types';
import { StatusBadge } from '../shared/StatusBadge';

/**
 * Shows the most recent incidents for quick access. Limited to 5 items
 * to keep the dashboard panel compact; users can open any incident
 * via the drawer without navigating away.
 */
export function WatchList() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const t = useI18n((s) => s.t);
  const [selected, setSelected] = useState<string | null>(null);
  const timeAgoFn = useTimeAgo();

  useEffect(() => {
    api<any>('/incidents?limit=5')
      .then((d) => setIncidents(d.items || d))
      .catch((err) => console.error('Failed to load incidents:', err));
  }, []);

  return (
    <div className="watch-list">
      {incidents.length === 0 ? (
        <div className="empty-state empty-compact">
          <div className="empty-title">{t('dashboard.empty.noIncidents')}</div>
        </div>
      ) : (
        incidents.map((i) => (
          <button key={i.id} className="incident-compact" onClick={() => setSelected(i.id)}>
            <div className={`category-icon-box ${categoryPriorityClass[i.priority] || 'category-medium'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="incident-compact-title">{i.title}</div>
              <div className="incident-compact-meta">{i.site.name} &middot; {timeAgoFn(i.createdAt)}</div>
            </div>
            <StatusBadge value={i.status} />
            <ChevronRight size={16} className="incident-compact-chevron" />
          </button>
        ))
      )}
      {selected && <Drawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
