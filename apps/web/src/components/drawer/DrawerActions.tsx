import { Clock, Send, AlertTriangle, Play, MapPin, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { timeAgo } from '../../lib/utils';

const PROGRESS_TYPES = [
  { value: 'STARTED', label: 'Début intervention', icon: Play, color: '#2d8a5e' },
  { value: 'ON_SITE', label: 'Sur site', icon: MapPin, color: '#2d8a5e' },
  { value: 'BLOCKED', label: 'Bloqué', icon: AlertTriangle, color: '#c87a2a' },
  { value: 'UPDATE', label: 'Mise à jour', icon: RefreshCw, color: '#3b7dd8' },
];

/** Incident workflow actions (assign, accept, resolve, close, reject, reassign, progress). */
interface DrawerActionsProps {
  incident: any;
  assignment: any;
  responsables: any[];
  actionLoading: boolean;
  onAssign: (respId: string) => void;
  onAccept: () => void;
  onResolve: () => void;
  onClose: () => void;
  onReject: () => void;
  onReassign: () => void;
  onProgress: () => void;
  showReassign: boolean;
  setShowReassign: (v: boolean) => void;
  reassignReason: string;
  setReassignReason: (v: string) => void;
  showReject: boolean;
  setShowReject: (v: boolean) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  showResolve: boolean;
  setShowResolve: (v: boolean) => void;
  resolveText: string;
  setResolveText: (v: string) => void;
  showProgress: string | null;
  setShowProgress: (v: string | null) => void;
  progressNote: string;
  setProgressNote: (v: string) => void;
  canProgress: boolean;
  canAssign?: boolean;
}

export function DrawerActions({
  incident, assignment, responsables, actionLoading,
  onAssign, onAccept, onResolve, onClose, onReject, onReassign, onProgress,
  showReassign, setShowReassign, reassignReason, setReassignReason,
  showReject, setShowReject, rejectReason, setRejectReason,
  showResolve, setShowResolve, resolveText, setResolveText,
  showProgress, setShowProgress, progressNote, setProgressNote, canProgress,
  canAssign = true
}: DrawerActionsProps) {
  const t = useI18n((s) => s.t);

  return (
    <div className="drawer-action-wrap">
      {incident.status === 'CLOSED' && (
        <div className="closed-message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          {t('drawer.closedNotice')}
        </div>
      )}

      {canAssign && incident.status === 'NEW' && (
        <div className="drawer-actions-row">
          <button className="button button-primary drawer-action" onClick={() => setShowReassign(!showReassign)} disabled={actionLoading}>
            {t('drawer.assignResponsable')}
          </button>
        </div>
      )}

      {incident.status === 'ASSIGNED' && assignment && (
        <div className="drawer-actions-row">
          <button className="button button-primary drawer-action" onClick={onAccept} disabled={actionLoading}>
            {actionLoading ? t('drawer.loading') : t('drawer.acceptAssignment')}
          </button>
          <button className="button button-outline drawer-action" onClick={() => setShowReassign(!showReassign)} disabled={actionLoading}>
            {t('drawer.requestReassignment')}
          </button>
        </div>
      )}

      {incident.status === 'IN_PROGRESS' && (
        <div className="drawer-actions-row">
          <button className="button button-primary drawer-action" onClick={() => setShowResolve(true)} disabled={actionLoading}>
            {t('drawer.submitResolution')}
          </button>
        </div>
      )}

      {incident.status === 'RESOLVED' && (
        <div className="drawer-actions-row">
          <button className="button button-primary drawer-action" onClick={onClose} disabled={actionLoading}>
            {actionLoading ? t('drawer.loading') : t('drawer.closeIncident')}
          </button>
          <button className="button button-danger drawer-action" onClick={() => setShowReject(!showReject)} disabled={actionLoading}>
            {t('drawer.rejectResolution')}
          </button>
        </div>
      )}

      {canAssign && showReassign && incident.status === 'NEW' && (
        <div className="reassign-section" style={{ marginTop: 12 }}>
          <div className="reassign-title">{t('drawer.assignResponsable')}</div>
          <select style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0d0b8', borderRadius: 6, fontSize: 11, marginBottom: 8 }}
            onChange={(e) => e.target.value && onAssign(e.target.value)}>
            <option value="">{t('drawer.chooseResponsable')}</option>
            {responsables.filter((r: any) => r.isActive).map((r: any) => (
              <option key={r.id} value={r.id}>{r.user.name}</option>
            ))}
          </select>
        </div>
      )}

      {showReassign && incident.status === 'ASSIGNED' && (
        <div className="reassign-section" style={{ marginTop: 12 }}>
          <div className="reassign-title">{t('drawer.requestReassignment')}</div>
          <textarea placeholder={t('drawer.reassignmentReason')} value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} maxLength={500} />
          {reassignReason.trim().length > 0 && reassignReason.trim().length < 5 && (
            <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>{t('drawer.minChars5')}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#98a5a8' }}>{reassignReason.length}/500</span>
            <button className="button button-primary button-small" disabled={reassignReason.trim().length < 5 || reassignReason.trim().length > 500 || actionLoading} onClick={onReassign}>
              {actionLoading ? t('drawer.sending') : t('drawer.send')}
            </button>
          </div>
        </div>
      )}

      {showResolve && (
        <div className="reassign-section" style={{ marginTop: 12 }}>
          <div className="reassign-title">{t('drawer.submitResolution')}</div>
          <textarea placeholder={t('drawer.resolutionReport')} value={resolveText} onChange={(e) => setResolveText(e.target.value)} style={{ minHeight: 80 }} maxLength={3000} />
          {resolveText.trim().length > 0 && (resolveText.trim().length < 10 || resolveText.trim().length > 3000) && (
            <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>
              {resolveText.trim().length < 10 ? t('drawer.minChars10') : t('drawer.maxChars3000')}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#98a5a8' }}>{resolveText.length}/3000</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="button button-ghost button-small" onClick={() => { setShowResolve(false); setResolveText(''); }}>{t('common.cancel')}</button>
              <button className="button button-primary button-small" disabled={resolveText.trim().length < 10 || resolveText.trim().length > 3000 || actionLoading} onClick={onResolve}>
                {actionLoading ? t('drawer.sending') : t('drawer.submitAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReject && (
        <div className="reassign-section reassign-reject" style={{ marginTop: 12 }}>
          <div className="reassign-title">{t('drawer.rejectResolution')}</div>
          <textarea placeholder={t('drawer.rejectReason')} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} />
          {rejectReason.trim().length > 0 && (rejectReason.trim().length < 5 || rejectReason.trim().length > 500) && (
            <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>
              {rejectReason.trim().length < 5 ? t('drawer.minChars5') : t('drawer.maxChars500')}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#98a5a8' }}>{rejectReason.length}/500</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="button button-ghost button-small" onClick={() => { setShowReject(false); setRejectReason(''); }}>{t('common.cancel')}</button>
              <button className="button button-danger button-small" disabled={rejectReason.trim().length < 5 || rejectReason.trim().length > 500 || actionLoading} onClick={onReject}>
                {actionLoading ? t('drawer.sending') : t('drawer.rejectAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgress && (
        <div className="reassign-section" style={{ marginTop: 12 }}>
          <div className="reassign-title">{t('drawer.progressUpdate')} {PROGRESS_TYPES.find(p => p.value === showProgress)?.label}</div>
          <textarea placeholder={t('drawer.progressPlaceholder')} value={progressNote} onChange={(e) => setProgressNote(e.target.value)} style={{ minHeight: 80 }} maxLength={2000} />
          {progressNote.trim().length > 0 && progressNote.trim().length > 2000 && (
            <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>{t('drawer.maxChars2000')}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#98a5a8' }}>{progressNote.length}/2000</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="button button-ghost button-small" onClick={() => { setShowProgress(null); setProgressNote(''); }}>{t('common.cancel')}</button>
              <button className="button button-primary button-small" disabled={progressNote.trim().length < 1 || progressNote.trim().length > 2000 || actionLoading} onClick={onProgress}>
                {actionLoading ? t('drawer.sending') : t('drawer.publish')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
