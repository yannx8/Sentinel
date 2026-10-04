import { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Spinner } from './Spinner';
import { useI18n } from '../../i18n';

interface StatusModalProps {
  status: 'loading' | 'success' | 'error' | 'empty';
  title?: string;
  message?: string;
  onClose?: () => void;
  onRetry?: () => void;
  autoClose?: number;
}

export function StatusModal({ status, title, message, onClose, onRetry, autoClose }: StatusModalProps) {
  const t = useI18n((s) => s.t);

  useEffect(() => {
    if (status === 'success' && autoClose && onClose) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [status, autoClose, onClose]);

  /* Scroll lock: prevent background scrolling while modal is open. */
  useEffect(() => {
    if (onClose) document.body.classList.add('no-scroll');
    return () => { if (onClose) document.body.classList.remove('no-scroll'); };
  }, [onClose]);

  const icons = {
    loading: <Spinner size={32} />,
    success: <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}><CheckCircle size={32} /></div>,
    error: <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', color: '#b91c1c', display: 'grid', placeItems: 'center' }}><XCircle size={32} /></div>,
    empty: <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', color: '#64748b', display: 'grid', placeItems: 'center' }}><AlertTriangle size={32} /></div>
  };

  const titles = {
    loading: title || t('statusModal.loading'),
    success: title || t('statusModal.success'),
    error: title || t('statusModal.error'),
    empty: title || t('statusModal.noData')
  };

  const messages = {
    loading: message || t('statusModal.loadingMsg'),
    success: message || t('statusModal.successMsg'),
    error: message || t('statusModal.errorMsg'),
    empty: message || t('statusModal.noDataMsg')
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="status-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 32px', textAlign: 'center' }}>
          {icons[status]}
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 20, marginBottom: 8 }}>
            {titles[status]}
          </div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, maxWidth: 300, marginBottom: status === 'error' || status === 'empty' ? 24 : 0 }}>
            {messages[status]}
          </div>
          {status === 'error' && onRetry && (
            <button className="button button-primary" onClick={onRetry} style={{ marginTop: 8 }}>
              {t('common.retry')}
            </button>
          )}
          {status === 'error' && !onRetry && onClose && (
            <button className="button button-outline" onClick={onClose} style={{ marginTop: 8 }}>
              {t('common.close')}
            </button>
          )}
          {status === 'empty' && onClose && (
            <button className="button button-outline" onClick={onClose} style={{ marginTop: 8 }}>
              {t('common.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
