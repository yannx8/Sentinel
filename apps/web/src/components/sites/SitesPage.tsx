import { useEffect, useState } from 'react';
import { Building2, MapPin, Edit3, Plus, AlertTriangle, CircleDashed } from 'lucide-react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { Site } from '../../types';
import { Spinner } from '../shared/Spinner';
import { Toast } from '../shared/Toast';
import { MapLocationPicker } from '../map/MapLocationPicker';
import { X, CheckCircle } from 'lucide-react';

export function Sites() {
  const [data, setData] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [toast, setToast] = useState('');
  const t = useI18n((s) => s.t);

  const load = () => {
    setLoading(true);
    setError('');
    api('/sites')
      .then(setData)
      .catch((err) => setError(err.message || t('errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page-stack sites-page" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24, animation: 'page-in 0.25s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', fontFamily: "'Manrope', sans-serif", margin: 0 }}>{t('sites.title')}</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('sites.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#0f172a', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transition: 'background 0.15s' }}
        >
          <Plus size={16} /> {t('sites.add')}
        </button>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>}

      {!loading && error && (
        <div className="empty-state">
          <AlertTriangle size={32} className="empty-icon" />
          <div className="empty-title">{t('errors.loadFailed')}</div>
          <div className="empty-desc">{error}</div>
          <button className="button button-outline" onClick={load}>{t('common.retry')}</button>
        </div>
      )}

      {!loading && !error && (
        <div className="site-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {data.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><Building2 size={18} /></div>
              <div className="empty-title">{t('sites.empty')}</div>
              <div className="empty-desc">{t('sites.emptyDesc')}</div>
              <button className="button button-primary" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> {t('sites.add')}
              </button>
            </div>
          ) : (
            data.map((s) => (
              <div key={s.id} className="card-hover" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: '#EFF6FF', borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Building2 size={20} color="#2563EB" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{s.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 12, color: '#64748b' }}>
                        <MapPin size={12} />
                        <span>{s.address || t('sites.noAddress')}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingSite(s)}
                    style={{ padding: 8, background: 'transparent', border: 'none', color: '#94A3B8', borderRadius: 8, cursor: 'pointer', transition: 'color 0.15s, background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{s._count?.incidents ?? 0}</span> {t('sites.incidents')}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    {s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}
                  </div>
                  {s.radiusMeters && <div className="site-perimeter-summary"><CircleDashed size={13} /> {s.radiusMeters} m</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showCreate && <SiteModal mode="create" onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editingSite && <SiteModal mode="edit" site={editingSite} onClose={() => setEditingSite(null)} onSaved={() => { setEditingSite(null); load(); }} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

interface SiteModalProps {
  mode: 'create' | 'edit';
  site?: Site;
  onClose: () => void;
  onSaved: () => void;
}

function SiteModal({ mode, site, onClose, onSaved }: SiteModalProps) {
  const [name, setName] = useState(site?.name || '');
  const [address, setAddress] = useState(site?.address || '');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    site ? { latitude: site.latitude, longitude: site.longitude } : null
  );
  const [radiusMeters, setRadiusMeters] = useState(site?.radiusMeters?.toString() || '250');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const t = useI18n((s) => s.t);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.classList.add('no-scroll');
    document.addEventListener('keydown', h);
    return () => {
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', h);
    };
  }, [onClose]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.length < 2 || name.length > 100) e.name = t('sites.nameError');
    if (!location) e.location = t('sites.locationRequired');
    const radius = Number(radiusMeters);
    if (!Number.isFinite(radius) || radius < 25 || radius > 5000) e.perimeter = t('sites.perimeterError');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiErr('');
    try {
      const payload = {
        name: name.trim(), address: address.trim() || null, latitude: location!.latitude, longitude: location!.longitude,
        boundaryType: 'CIRCLE', radiusMeters: Number(radiusMeters)
      };
      if (mode === 'create') {
        await api('/sites', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await api('/sites/' + site!.id, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (err: any) {
      setApiErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="create-modal site-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="site-modal-title">
        <div className="modal-header">
          <div>
            <h2 id="site-modal-title">{mode === 'create' ? t('sites.add') : t('sites.edit')}</h2>
            <div className="modal-subtitle">{mode === 'create' ? t('sites.createSubtitle') : t('sites.editSubtitle')}</div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field span-full">
              <label>{t('sites.name')} <em>*</em></label>
              <input maxLength={100} placeholder={t('sites.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
            <div className="form-field span-full">
              <label>{t('sites.address')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{t('sites.addressOptional')}</span></label>
              <input placeholder={t('sites.addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="form-field span-full">
              <label>{t('sites.location')} <em>*</em></label>
              <MapLocationPicker
                value={location}
                onChange={(loc) => {
                  setLocation(loc);
                  setErrors((prev) => { const n = { ...prev }; delete n.location; return n; });
                  if (loc.address && !address) setAddress(loc.address);
                }}
                height={240}
                draggable
              />
              {errors.location && <div className="form-error">{errors.location}</div>}
            </div>
            <div className="form-field span-full">
              <label>{t('sites.perimeter')} <em>*</em></label>
              <div className="perimeter-control">
                <div className="perimeter-icon"><CircleDashed size={18} /></div>
                <div>
                  <strong>{t('sites.perimeterRadius')}</strong>
                  <span>{t('sites.perimeterHint')}</span>
                </div>
                <label className="perimeter-input">
                  <input type="number" min="25" max="5000" step="25" value={radiusMeters} onChange={(e) => { setRadiusMeters(e.target.value); setErrors((prev) => ({ ...prev, perimeter: '' })); }} />
                  <span>m</span>
                </label>
              </div>
              {errors.perimeter && <div className="form-error">{errors.perimeter}</div>}
            </div>
          </div>
          {apiErr && <div className="auth-error" style={{ margin: '8px 0 0' }}>{apiErr}</div>}
        </div>
        <div className="form-footer">
          <button className="button button-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="button button-primary" onClick={submit} disabled={submitting}>
            {submitting ? <><Spinner size={14} /> {mode === 'create' ? t('sites.creating') : t('sites.saving')}</> : <><CheckCircle size={14} /> {mode === 'create' ? t('sites.create') : t('sites.save')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
