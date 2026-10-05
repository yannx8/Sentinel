import { useEffect, useState } from 'react';
import { Users, Shield, MapPin, AlertTriangle, Pencil, ArrowUpRight, UserRoundPlus } from 'lucide-react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { Spinner } from '../shared/Spinner';
import { Toast } from '../shared/Toast';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { TeamFormModal } from './TeamFormModal';

interface ResponsableRecord {
  id: string;
  isActive: boolean;
  user: { id: string; name: string; email: string };
  specialties: { id: string; specialty: { id: string; name: string } }[];
  sites: { id: string; site: { id: string; name: string } }[];
}

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#D97706', '#059669', '#DC2626', '#0891B2'];

export function Team() {
  const [data, setData] = useState<ResponsableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ResponsableRecord | null>(null);
  const [deactivating, setDeactivating] = useState<ResponsableRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useI18n((s) => s.t);

  const load = () => {
    setLoading(true);
    api('/responsables')
      .then(setData)
      .catch((err) => setError(err.message || t('errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDeactivate = async () => {
    if (!deactivating) return;
    setSaving(true);
    try {
      await api('/responsables/' + deactivating.id, { method: 'PATCH', body: JSON.stringify({ isActive: false }) });
      setToast(t('team.deactivateSuccess'));
      setDeactivating(null);
    } catch (err: any) {
      setToast(err.message || t('common.error'));
    } finally {
      setSaving(false);
      load();
    }
  };

  const handleReactivate = async (r: ResponsableRecord) => {
    try {
      await api('/responsables/' + r.id, { method: 'PATCH', body: JSON.stringify({ isActive: true }) });
      setToast(t('team.reactivateSuccess'));
    } catch (err: any) {
      setToast(err.message || t('common.error'));
    }
    load();
  };

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
      </div>
    );
  }

  return (
    <div className="page-stack team-page" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24, animation: 'page-in 0.25s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', fontFamily: "'Manrope', sans-serif", margin: 0 }}>{t('team.title')}</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('team.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="team-add-button"
        >
          <UserRoundPlus size={17} /> {t('team.add')}
        </button>
      </div>

      {error && (
        <div className="empty-state">
          <AlertTriangle size={32} className="empty-icon" />
          <div className="empty-title">{t('errors.loadFailed')}</div>
          <div className="empty-desc">{error}</div>
          <button className="button button-outline" onClick={load}>{t('common.retry')}</button>
        </div>
      )}

      <div className="team-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {data.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-icon"><Users size={18} /></div>
            <div className="empty-title">{t('team.empty')}</div>
            <div className="empty-desc">{t('team.emptyDesc')}</div>
            <button className="button button-primary" onClick={() => setShowCreate(true)}>
              <UserRoundPlus size={16} /> {t('team.add')}
            </button>
          </div>
        ) : (
          data.map((r, idx) => {
            const initials = r.user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <div key={r.id} className="card-hover" style={{ padding: 20, opacity: r.isActive ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 43, height: 43, borderRadius: '50%', background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{r.user.name}</h3>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{r.user.email}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 8px', borderRadius: 999, background: '#EFF6FF', color: '#1D4ED8', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Shield size={10} /> {t('team.roleLabel')}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditing(r)}
                    style={{ padding: 8, background: 'transparent', border: 'none', color: '#94A3B8', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('team.specialtiesLabel')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {r.specialties?.length > 0 ? r.specialties.map((s) => (
                      <span key={s.id} style={{ padding: '3px 8px', background: '#f1f5f9', borderRadius: 6, fontSize: 11, fontWeight: 500, color: '#475569' }}>{s.specialty.name}</span>
                    )) : (
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{t('team.noSpecialties')}</span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('team.assignedSitesLabel')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#64748b' }}>
                    <MapPin size={12} />
                    <span>{r.sites?.length > 0 ? r.sites.map((s) => s.site?.name).filter(Boolean).join(', ') : t('team.noSites')}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                  {r.isActive ? (
                    <button
                      onClick={() => setDeactivating(r)}
                      style={{ flex: 1, padding: '8px 0', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#64748b', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    >
                      {t('team.deactivate')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(r)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', background: '#2563EB', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                    >
                      <ArrowUpRight size={13} /> {t('team.reactivate')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreate && <TeamFormModal mode="create" onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editing && <TeamFormModal mode="edit" record={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deactivating && (
        <ConfirmDialog
          title={t('team.deactivateTitle')}
          message={`${t('team.deactivateMessage')} ${deactivating.user.name}?`}
          confirmLabel={t('team.deactivate')}
          confirmColor="#DC2626"
          busy={saving}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivating(null)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
