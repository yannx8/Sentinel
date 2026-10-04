import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useI18n((s) => s.t);
  return (
    <div className="empty-state">
      <div className="empty-icon" style={{ background: '#fae9eb', color: '#ae5c68' }}>
        <AlertTriangle size={18} />
      </div>
      <strong style={{ color: '#ae5c68' }}>{t('common.error')}</strong>
      <span>{message}</span>
      {onRetry && (
        <button className="button button-secondary button-small" style={{ marginTop: 8 }} onClick={onRetry}>
          <RefreshCw size={13} /> {t('common.retry')}
        </button>
      )}
    </div>
  );
}
