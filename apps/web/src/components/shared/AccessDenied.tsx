import { ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n';

export function AccessDenied() {
  const t = useI18n((s) => s.t);
  return (
    <div className="empty-state" style={{ minHeight: 300 }}>
      <div className="empty-icon" style={{ background: '#fae9eb', color: '#ae5c68' }}>
        <ShieldAlert size={22} />
      </div>
      <strong>{t('accessDenied.title')}</strong>
      <span>{t('accessDenied.description')}</span>
    </div>
  );
}
