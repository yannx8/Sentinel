import React, { useEffect, useState } from 'react';
import { Bell, X, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../../store/notificationStore';
import { notifIconClass } from '../../constants';
import { Spinner } from '../shared/Spinner';
import { useI18n } from '../../i18n';

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { items, load, read } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const panelRef = React.useRef<HTMLDivElement>(null);
  const t = useI18n((s) => s.t);

  useEffect(() => {
    setLoading(true);
    setError('');
    load()
      .catch((err) => setError(err.message || t('errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [load, t]);

  // Close panel on outside click. Uses mousedown (not click) so the panel
  // dismisses before any click-through element receives focus.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleRead = async (id: string) => {
    try { await read(id); } catch { /* ignore */ }
  };

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="notifications-panel" ref={panelRef}>
      <div className="notifications-header">
        <span className="notifications-header-title">
          {t('notifications.title')} {unread > 0 && <span className="notifications-header-count">({unread})</span>}
        </span>
        <button className="notifications-header-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><Spinner size={18} /></div>
      ) : error ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#c76b3c', fontSize: 11 }}>
          <AlertTriangle size={16} style={{ marginBottom: 4 }} />
          <div>{error}</div>
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
          {t('notifications.empty')}
        </div>
      ) : (
        items.slice(0, 8).map((n) => (
          <div
            key={n.id}
            className={`notification-row${n.readAt ? ' notification-read' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => { if (!n.readAt) handleRead(n.id); }}
          >
            <div className={`notification-icon ${notifIconClass.default}`}>
              <Bell size={14} />
            </div>
            <div className="notification-content">
              <div className="notification-title">{n.title}</div>
              <div className="notification-body">{n.body}</div>
            </div>
            {!n.readAt && <div className="notification-unread-dot" />}
          </div>
        ))
      )}
      <div className="notifications-footer">
        {items.length > 0 ? t('notifications.viewAll') : t('notifications.empty')}
      </div>
    </div>
  );
}
