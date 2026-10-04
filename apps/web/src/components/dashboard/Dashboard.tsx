import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, ClipboardList, CheckCircle, ChevronRight, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { Spinner } from '../shared/Spinner';
import { StatusBadge } from '../shared/StatusBadge';
import { PriorityBadge } from '../shared/PriorityBadge';
import { KpiCard } from './KpiCard';
import { WatchList } from './WatchList';
import { StatusDistribution } from './StatusDistribution';
import { PriorityDistribution } from './PriorityDistribution';
import { CategoryDistribution } from './CategoryDistribution';
import { TrendChart } from './TrendChart';
import { Drawer } from '../drawer/IncidentDrawer';
import { useTimeAgo } from '../../lib/utils';
import { categoryPriorityClass } from '../../constants';

function getGreeting(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greeting.morning');
  if (h < 18) return t('dashboard.greeting.afternoon');
  return t('dashboard.greeting.evening');
}

function getDateLabel() {
  const d = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

/** Top-level dashboard router */
export function Dashboard() {
  const u = useAuth((s) => s.user)!;
  const admin = u.roles.includes('ADMINISTRATOR');
  const responsable = u.roles.includes('RESPONSABLE');

  if (admin) return <AdminDashboard />;
  if (responsable) return <ResponsableDashboard />;
  return <UserDashboard />;
}

function UserDashboard() {
  const u = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const t = useI18n((s) => s.t);
  const timeAgoFn = useTimeAgo();

  useEffect(() => {
    setLoading(true);
    api<any>('/incidents?limit=20')
      .then((d) => setIncidents(d.items || []))
      .catch((err) => setError(err.message || t('dashboard.errorLoading')))
      .finally(() => setLoading(false));
  }, [t]);

  const greeting = getGreeting(t);

  return (
    <div className="page">
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> {getDateLabel()}
          </div>
          <h1>{greeting}, {u.name.split(' ')[0]} <span className="wave">&#10022;</span></h1>
          <p>{t('dashboard.userSubtitle')}</p>
        </div>
        <button onClick={() => nav('/incidents?new=1')} className="flex items-center gap-2 px-5 py-3 bg-nexus-600 text-white rounded-xl font-semibold text-sm hover:bg-nexus-700 transition-colors shadow-sm flex-shrink-0"><Plus size={18} /><span className="hidden sm:inline">Report incident</span></button>
      </div>

      {loading && (
        <div className="loading-page"><Spinner size={32} /></div>
      )}

      {!loading && error && (
        <div className="empty-state">
          <AlertTriangle size={40} className="empty-icon" />
          <div className="empty-title">{t('common.error')}</div>
          <div className="empty-desc">{error}</div>
          <button className="button button-outline" onClick={() => window.location.reload()}>{t('common.retry')}</button>
        </div>
      )}

      {!loading && !error && (
        <div className="kpi-grid">
          <KpiCard label={t('dashboard.kpi.myReports')} value={incidents.length} variant="teal" subtitle={t('dashboard.kpi.totalReports')} />
          <KpiCard label={t('dashboard.kpi.inProgress')} value={incidents.filter((i) => i.status === 'IN_PROGRESS').length} variant="orange" subtitle={t('dashboard.kpi.inProgressSub')} />
          <KpiCard label={t('dashboard.kpi.pending')} value={incidents.filter((i) => i.status === 'NEW' || i.status === 'ASSIGNED').length} variant="coral" subtitle={t('dashboard.kpi.pendingSub')} />
          <KpiCard label={t('dashboard.kpi.resolved')} value={incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length} variant="green" subtitle={t('dashboard.kpi.resolvedRate')}
            trend={incidents.length > 0 ? Math.round((incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length / incidents.length) * 100) : 0}
          />
        </div>
      )}

      {!loading && !error && incidents.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2>{t('dashboard.sections.mesIncidents')}</h2>
            <p>{incidents.length} {t('dashboard.countSuffix')}</p>
          </div>
          <div className="user-incidents-list">
            {incidents.map((i) => (
              <button key={i.id} className="incident-compact" onClick={() => setSelected(i.id)}>
                <div className={`category-icon-box ${categoryPriorityClass[i.priority] || 'category-medium'}`}>
                  <ClipboardList size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="incident-compact-title">{i.title}</div>
                  <div className="incident-compact-meta">{i.site?.name} &middot; {timeAgoFn(i.createdAt)}</div>
                </div>
                <StatusBadge value={i.status} />
                <ChevronRight size={16} className="incident-compact-chevron" />
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && <Drawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ResponsableDashboard() {
  const u = useAuth((s) => s.user)!;
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const t = useI18n((s) => s.t);
  const timeAgoFn = useTimeAgo();

  const load = () => {
    setLoading(true);
    api<any>('/incidents?limit=50')
      .then((d) => setIncidents(d.items || []))
      .catch((err) => setError(err.message || t('dashboard.errorLoadingResp')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toAccept = incidents.filter((i) => i.status === 'ASSIGNED');
  const inProgress = incidents.filter((i) => i.status === 'IN_PROGRESS');
  const awaitingResolution = incidents.filter((i) => i.status === 'RESOLVED');
  const totalActions = toAccept.length + inProgress.length;
  const greeting = getGreeting(t);

  return (
    <div className="page">
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> {getDateLabel()}
          </div>
          <h1>{greeting}, {u.name.split(' ')[0]} <span className="wave">&#10022;</span></h1>
          <p>
            {totalActions > 0
              ? `${totalActions} ${t('dashboard.responsableSubtitle.attention')}`
              : t('dashboard.responsableSubtitle.noAction')}
          </p>
        </div>
      </div>

      {loading && (
        <div className="loading-page"><Spinner size={32} /></div>
      )}

      {!loading && error && (
        <div className="empty-state">
          <AlertTriangle size={40} className="empty-icon" />
          <div className="empty-title">{t('common.error')}</div>
          <div className="empty-desc">{error}</div>
          <button className="button button-outline" onClick={load}>{t('common.retry')}</button>
        </div>
      )}

      {!loading && !error && (
        <div className="kpi-grid">
          <KpiCard label={t('dashboard.kpi.myAssignments')} value={incidents.length} variant="teal" subtitle={t('dashboard.kpi.totalAssigned')} />
          <KpiCard label={t('dashboard.kpi.inProgress')} value={inProgress.length} variant="orange" subtitle={t('dashboard.kpi.inProgressSub')} />
          <KpiCard label={t('dashboard.kpi.toAccept')} value={toAccept.length} variant="coral" subtitle={t('dashboard.kpi.toAcceptSub')} />
          <KpiCard label={t('dashboard.kpi.resolved')} value={awaitingResolution.length} variant="green" subtitle={t('dashboard.kpi.awaitingVerification')} />
        </div>
      )}

      {!loading && !error && totalActions === 0 && inProgress.length === 0 && (
        <div className="empty-state">
          <CheckCircle size={40} className="empty-icon" style={{ color: 'var(--blue)' }} />
          <div className="empty-title">{t('dashboard.empty.upToDate')}</div>
          <div className="empty-desc">{t('dashboard.empty.upToDateDesc')}</div>
        </div>
      )}

      {!loading && !error && (
        <div className="responsable-dashboard">
          {toAccept.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2><span className="status-dot fill-orange" /> {t('dashboard.sections.toAccept')}</h2>
                <p>{toAccept.length} {t('dashboard.sections.toAcceptCount')}</p>
              </div>
              <div className="user-incidents-list">
                {toAccept.map((i) => (
                  <button key={i.id} className="incident-compact incident-compact-action" onClick={() => setSelected(i.id)}>
                    <PriorityBadge value={i.priority} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="incident-compact-title">{i.title}</div>
                      <div className="incident-compact-meta">{i.site?.name} &middot; {t('dashboard.sections.assigned')} {timeAgoFn(i.updatedAt)}</div>
                    </div>
                    <span className="button button-sm button-outline">{t('dashboard.actions.accept')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {inProgress.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2><span className="status-dot fill-teal" /> {t('dashboard.sections.inProgress')}</h2>
                <p>{inProgress.length} {t('dashboard.sections.inProgressCount')}</p>
              </div>
              <div className="user-incidents-list">
                {inProgress.map((i) => (
                  <button key={i.id} className="incident-compact" onClick={() => setSelected(i.id)}>
                    <PriorityBadge value={i.priority} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="incident-compact-title">{i.title}</div>
                      <div className="incident-compact-meta">{i.site?.name} &middot; {timeAgoFn(i.updatedAt)}</div>
                    </div>
                    <StatusBadge value={i.status} />
                    <ChevronRight size={16} className="incident-compact-chevron" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {awaitingResolution.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2><span className="status-dot fill-blue" /> {t('dashboard.sections.resolutionPending')}</h2>
                <p>{awaitingResolution.length} {t('dashboard.sections.resolutionPendingCount')}</p>
              </div>
              <div className="user-incidents-list">
                {awaitingResolution.map((i) => (
                  <button key={i.id} className="incident-compact" onClick={() => setSelected(i.id)}>
                    <PriorityBadge value={i.priority} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="incident-compact-title">{i.title}</div>
                      <div className="incident-compact-meta">{i.site?.name} &middot; {t('dashboard.sections.submitted')} {timeAgoFn(i.updatedAt)}</div>
                    </div>
                    <StatusBadge value={i.status} />
                    <ChevronRight size={16} className="incident-compact-chevron" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selected && <Drawer id={selected} onClose={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function AdminDashboard() {
  const u = useAuth((s) => s.user)!;
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [toReview, setToReview] = useState<any[]>([]);
  const [allIncidents, setAllIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const nav = useNavigate();
  const t = useI18n((s) => s.t);
  const timeAgoFn = useTimeAgo();

  useEffect(() => {
    Promise.all([
      api<any>('/dashboard'),
      api<any>('/incidents?status=NEW&limit=10'),
      api<any>('/incidents?status=RESOLVED&limit=10'),
      api<any>('/incidents?limit=20')
    ]).then(([dash, un, rev, all]) => {
      setD(dash);
      setUnassigned(un.items || []);
      setToReview(rev.items || []);
      setAllIncidents(all.items || []);
    }).catch((err) => setError(err.message || t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  const greeting = getGreeting(t);

  if (loading) {
    return <div className="loading-page"><Spinner size={32} /></div>;
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <AlertTriangle size={40} className="empty-icon" />
          <div className="empty-title">{t('common.error')}</div>
          <div className="empty-desc">{error}</div>
          <button className="button button-outline" onClick={() => window.location.reload()}>{t('common.retry')}</button>
        </div>
      </div>
    );
  }

  const attentionItems = [
    ...unassigned.slice(0, 1).map((i: any) => ({ ...i, _action: 'assign', _actionLabel: 'Assign >' })),
    ...toReview.slice(0, 1).map((i: any) => ({ ...i, _action: 'review', _actionLabel: 'Review >' }))
  ];

  return (
    <div className="page">
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> {getDateLabel()}
          </div>
          <h1>{greeting}, {u.name.split(' ')[0]}</h1>
          <p>{t('dashboard.adminSubtitle')}</p>
        </div>
        <button onClick={() => nav('/incidents?new=1')} className="flex items-center gap-2 px-5 py-3 bg-nexus-600 text-white rounded-xl font-semibold text-sm hover:bg-nexus-700 transition-colors shadow-sm flex-shrink-0"><Plus size={18} /><span className="hidden sm:inline">Report incident</span></button>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('dashboard.kpi.activeIncidents')} value={d.active ?? 0} variant="teal" subtitle={t('dashboard.kpi.activeSub')} />
        <KpiCard label={t('dashboard.kpi.critical')} value={d.critical ?? 0} variant="coral" subtitle={t('dashboard.kpi.criticalSub')} />
        <KpiCard label={t('dashboard.kpi.pending')} value={unassigned.length} variant="orange" subtitle={t('dashboard.kpi.pendingSub')} />
        <KpiCard label={t('dashboard.kpi.toReview')} value={d.toReview ?? 0} variant="green" subtitle={t('dashboard.kpi.toReviewSub')} />
      </div>

      {attentionItems.length > 0 && (
        <div className="needs-attention-section">
          <div className="needs-attention-header">
            <h2>Needs attention</h2>
            <a href="#" onClick={(e) => { e.preventDefault(); nav('/incidents'); }}>View all <ArrowRight size={14} /></a>
          </div>
          <div className="needs-attention-sub">Incidents requiring an assignment or decision.</div>
          <div className="needs-attention-scroll">
            {attentionItems.map((i) => (
              <div
                key={i.id}
                className={`attention-card ${i._action === 'assign' ? 'attention-card-critical' : 'attention-card-review'}`}
                onClick={() => setSelected(i.id)}
              >
                <div className={`attention-icon ${i._action === 'assign' ? 'attention-icon-critical' : 'attention-icon-review'}`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="attention-body">
                  <div className="attention-meta">
                    <span className={i._action === 'assign' ? 'attention-badge-critical' : 'attention-badge-review'}>
                      {i._action === 'assign' ? 'Critical' : 'Review'}
                    </span>
                    <span className="attention-time">{timeAgoFn(i.createdAt).toUpperCase()}</span>
                  </div>
                  <div className="attention-title">{i.title}</div>
                  <div className="attention-site">{i.site?.name}</div>
                </div>
                <span className="attention-action">{i._actionLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allIncidents.length > 0 && (
        <div className="recent-incidents-section">
          <div className="recent-incidents-header">
            <h2>Recent incidents</h2>
            <a href="#" onClick={(e) => { e.preventDefault(); nav('/incidents'); }}>Open incident register <ArrowRight size={14} /></a>
          </div>
          <div className="recent-incidents-sub">Live operational activity across your sites.</div>
          <div className="incidents-table-panel">
            <div className="incidents-table-toolbar">
              <div className="incidents-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input placeholder="Search ID, incident or site" readOnly />
              </div>
              <select className="incidents-filter-select">
                <option>All statuses</option>
              </select>
              <select className="incidents-filter-select">
                <option>All priorities</option>
              </select>
            </div>
            <div className="incidents-table-head">
              <span>INCIDENT</span>
              <span>LOCATION</span>
              <span>STATUS</span>
              <span>PRIORITY</span>
              <span>OWNER</span>
              <span>UPDATED</span>
              <span />
            </div>
            {allIncidents.slice(0, 8).map((i: any) => {
              const ownerName = i.assignments?.find((a: any) => a.isActive)?.responsable?.user?.name;
              const ownerInitials = ownerName ? ownerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : null;
              const avatarColors = ['owner-avatar-green', 'owner-avatar-blue', 'owner-avatar-purple', 'owner-avatar-orange', 'owner-avatar-rose'];
              const avatarColor = avatarColors[Math.abs(i.id.charCodeAt(0)) % avatarColors.length];
              return (
                <div key={i.id} className="incidents-table-row" onClick={() => setSelected(i.id)}>
                  <div>
                    <div className="incident-cell-title">{i.title}</div>
                    <div className="incident-cell-meta">{i.id.slice(0, 8).toUpperCase()} · {i.category}</div>
                  </div>
                  <div>
                    <div className="incident-cell-site">{i.site?.name}</div>
                  </div>
                  <div><StatusBadge value={i.status} /></div>
                  <div><PriorityBadge value={i.priority} /></div>
                  <div>
                    {ownerName ? (
                      <div className="owner-cell">
                        <div className={`owner-avatar ${avatarColor}`}>{ownerInitials}</div>
                        <span className="owner-name">{ownerName}</span>
                      </div>
                    ) : (
                      <div className="owner-cell">
                        <div className="owner-avatar owner-avatar-green" style={{ background: '#f1f5f9', color: '#94a3b8' }}>—</div>
                        <span className="owner-unassigned">Unassigned</span>
                      </div>
                    )}
                  </div>
                  <div className="incident-cell-time">{timeAgoFn(i.updatedAt)}</div>
                  <div><ChevronRight size={16} color="#b3bfc1" /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && <Drawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

