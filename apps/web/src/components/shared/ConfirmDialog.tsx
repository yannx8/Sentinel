import { AlertTriangle, X } from 'lucide-react';
import { useI18n } from '../../i18n';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor = 'var(--blue)',
  busy,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const t = useI18n((s) => s.t);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="create-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, borderRadius: 14, overflow: 'hidden' }}
      >
        <div className="modal-header" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="confirm-warning"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: '#FEE2E2',
                color: '#DC2626',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>{title}</h2>
            </div>
          </div>
          <button className="icon-button" onClick={onCancel} style={{ color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
          {message}
        </div>
        <div
          className="form-footer"
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border-light)' }}
        >
          <button className="button button-outline" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className="button button-primary"
            onClick={onConfirm}
            disabled={busy}
            style={{ background: confirmColor }}
          >
            {busy ? t('common.loading') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
