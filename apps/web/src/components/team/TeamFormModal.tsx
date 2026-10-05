import { useEffect, useState } from 'react';
import { Check, ChevronDown, Search, UserPlus, X } from 'lucide-react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { Spinner } from '../shared/Spinner';
import { Toast } from '../shared/Toast';

interface Candidate {
  id: string;
  name: string;
  email: string;
}

interface Specialty {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
}

interface ResponsableRecord {
  id: string;
  isActive: boolean;
  user: { id: string; name: string; email: string };
  specialties: { id: string; specialty: Specialty }[];
  sites: { id: string; site: { id: string; name: string } }[];
}

interface TeamFormModalProps {
  mode: 'create' | 'edit';
  record?: ResponsableRecord;
  onClose: () => void;
  onSaved: () => void;
}

export function TeamFormModal({ mode, record, onClose, onSaved }: TeamFormModalProps) {
  const t = useI18n((s) => s.t);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(record?.user.id || '');
  const [memberTouched, setMemberTouched] = useState(false);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(record?.isActive ?? true);
  const [searchCand, setSearchCand] = useState('');
  const [candOpen, setCandOpen] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [addingSpecialty, setAddingSpecialty] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const p1 = api<any[]>('/responsables/candidates').then(setCandidates).catch(() => setCandidates([]));
    const p2 = api<Specialty[]>('/responsables/specialties').then(setSpecialties).catch(() => setSpecialties([]));
    const p3 = api<Site[]>('/sites').then(setSites).catch(() => setSites([]));
    Promise.all([p1, p2, p3]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!record) return;
    setSelectedSpecialties(record.specialties.map((s) => s.specialty.id));
    setSelectedSites(record.sites.map((s) => s.site.id));
  }, [record]);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleSpecialty = (id: string) =>
    setSelectedSpecialties((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSite = (id: string) =>
    setSelectedSites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addSpecialty = async () => {
    const name = newSpecialty.trim();
    if (name.length < 2) {
      setApiErr(t('team.specialtyNameError'));
      return;
    }
    setAddingSpecialty(true);
    setApiErr('');
    try {
      const s = await api<Specialty>('/responsables/specialties', { method: 'POST', body: JSON.stringify({ name }) });
      setSpecialties((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
      setSelectedSpecialties((prev) => (prev.includes(s.id) ? prev : [...prev, s.id]));
      setNewSpecialty('');
    } catch (err: any) {
      setApiErr(err.message || t('common.error'));
    } finally {
      setAddingSpecialty(false);
    }
  };

  const filteredCands = candidates.filter(
    (c) => c.name.toLowerCase().includes(searchCand.toLowerCase()) || c.email.toLowerCase().includes(searchCand.toLowerCase())
  );

  const submit = async () => {
    if (mode === 'create' && !selectedUserId) {
      setMemberTouched(true);
      setApiErr(t('team.selectMember'));
      return;
    }
    setSubmitting(true);
    setApiErr('');
    try {
      if (mode === 'create') {
        const r = await api<{ id: string }>('/responsables', { method: 'POST', body: JSON.stringify({ userId: selectedUserId }) });
        await api('/responsables/' + r.id, {
          method: 'PATCH',
          body: JSON.stringify({ specialtyIds: selectedSpecialties, siteIds: selectedSites })
        });
      } else {
        await api('/responsables/' + record!.id, {
          method: 'PATCH',
          body: JSON.stringify({ isActive, specialtyIds: selectedSpecialties, siteIds: selectedSites })
        });
      }
      setToast(mode === 'create' ? t('team.creSuccess') : t('team.editSuccess'));
      setTimeout(onSaved, 300);
    } catch (err: any) {
      setApiErr(err.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="create-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }} role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
        <div className="modal-header">
          <div>
            <h2 id="team-modal-title">{mode === 'create' ? t('team.add') : t('team.edit')}</h2>
            <div className="modal-subtitle">
              {mode === 'create' ? t('team.createSubtitle') : t('team.editSubtitle')}
            </div>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="loading-page" style={{ minHeight: 220 }}><Spinner size={20} /></div>
        ) : (
          <>
            <div className="form-grid" style={{ padding: '20px 24px' }}>
              {mode === 'create' ? (
                <div className="form-field span-full">
                  <label>{t('team.member')} <em>*</em></label>
                  <div className="candidate-picker">
                    <button
                      className="candidate-trigger"
                      onClick={() => setCandOpen((o) => !o)}
                      type="button"
                    >
                      {selectedUserId
                        ? candidates.find((c) => c.id === selectedUserId)?.name || t('team.member')
                        : t('team.memberPlaceholder')}
                      <ChevronDown size={15} />
                    </button>
                    {candOpen && (
                      <div className="candidate-dropdown">
                        <div className="candidate-search">
                          <Search size={13} />
                          <input
                            autoFocus
                            placeholder={t('team.searchMember')}
                            value={searchCand}
                            onChange={(e) => setSearchCand(e.target.value)}
                          />
                        </div>
                        <div className="candidate-list">
                          {filteredCands.length === 0 && (
                            <div className="candidate-empty">{t('team.noCandidates')}</div>
                          )}
                          {filteredCands.map((c) => (
                            <button
                              key={c.id}
                              className="candidate-item"
                              onClick={() => { setSelectedUserId(c.id); setMemberTouched(false); setCandOpen(false); }}
                              type="button"
                            >
                              {selectedUserId === c.id && <Check size={14} className="candidate-check" />}
                              <div>
                                <div className="candidate-name">{c.name}</div>
                                <div className="candidate-email">{c.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {memberTouched && !selectedUserId && <div className="form-error" style={{ marginTop: 4 }}>{t('team.selectMember')}</div>}
                </div>
              ) : (
                <div className="form-field span-full">
                  <label>{t('settings.fullName')}</label>
                  <input readOnly value={record?.user.name || ''} disabled />
                </div>
              )}

              <div className="form-field span-full">
                <label>{t('team.specialties')}</label>
                <div className="chip-list">
                  {specialties.length === 0 && <span className="form-hint">{t('team.noSpecialties')}</span>}
                  {specialties.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`chip ${selectedSpecialties.includes(s.id) ? 'chip-on' : ''}`}
                      onClick={() => toggleSpecialty(s.id)}
                    >
                      {selectedSpecialties.includes(s.id) && <Check size={12} />}
                      {s.name}
                    </button>
                  ))}
                </div>
                <div className="chip-add-row">
                  <input
                    placeholder={t('team.newSpecialty')}
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
                  />
                  <button className="button button-outline button-small" type="button" onClick={addSpecialty} disabled={addingSpecialty}>
                    <UserPlus size={13} /> {t('team.addSpecialty')}
                  </button>
                </div>
              </div>

              <div className="form-field span-full">
                <label>{t('team.sites')}</label>
                <div className="site-checklist">
                  {sites.length === 0 && <span className="form-hint">{t('sites.empty')}</span>}
                  {sites.map((s) => (
                    <label key={s.id} className="site-check-item">
                      <input type="checkbox" checked={selectedSites.includes(s.id)} onChange={() => toggleSite(s.id)} />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {mode === 'edit' && (
                <div className="form-field span-full">
                  <label>{t('team.status')}</label>
                  <label className="status-toggle-row">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    <span>{isActive ? t('team.active') : t('team.inactive')}</span>
                  </label>
                </div>
              )}
            </div>

            {apiErr && <div className="auth-error" style={{ margin: '0 24px 8px' }}>{apiErr}</div>}

            <div className="form-footer">
              <button className="button button-ghost" onClick={onClose}>{t('common.cancel')}</button>
              <button className="button button-primary" onClick={submit} disabled={submitting}>
                {submitting ? <><Spinner size={14} /> {t('common.loading')}</> : (
                  <><CheckCircleSmall /> {mode === 'create' ? t('team.add') : t('team.save')}</>
                )}
              </button>
            </div>
          </>
        )}
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </div>
    </div>
  );
}

function CheckCircleSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
