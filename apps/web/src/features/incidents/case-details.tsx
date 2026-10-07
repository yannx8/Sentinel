import type { IncidentDetail } from '@sentinel/shared';
import type { ReactNode } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { useT } from '../../i18n';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </>
  );
}

export function CaseDetails({ incident }: { incident: IncidentDetail }) {
  const { t, date, duration } = useT();
  const created = new Date(incident.createdAt).getTime();
  const after = (iso: string | null) =>
    iso ? (
      <>
        {date(iso, 'datetime')}{' '}
        <span className="text-ink-3">
          ({t('incidents.caseFile.afterStart', { duration: duration((new Date(iso).getTime() - created) / 60_000) })})
        </span>
      </>
    ) : null;
  const live = incident.liveAssignment;
  const timeline: [string, string | null][] = [
    [t('incidents.caseFile.triaged'), incident.triagedAt],
    [t('incidents.caseFile.firstAssigned'), incident.firstAssignedAt],
    [t('incidents.caseFile.started'), incident.startedAt],
    [t('incidents.caseFile.resolved'), incident.resolvedAt],
    [t('incidents.caseFile.closed'), incident.closedAt],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('incidents.caseFile.description')}</h3>
        <p className="text-sm whitespace-pre-line text-ink-2">{incident.description}</p>
      </section>

      <dl className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        <Row label={t('incidents.caseFile.site')}>
          {incident.site.name} <span className="text-ink-3">({incident.site.code})</span>
        </Row>
        {incident.locationDetail && <Row label={t('incidents.caseFile.location')}>{incident.locationDetail}</Row>}
        <Row label={t('incidents.caseFile.category')}>{incident.category.name}</Row>
        {(incident.reportedCategory.id !== incident.category.id || incident.reportedPriority !== incident.priority) && (
          <Row label={t('incidents.caseFile.reported')}>
            {t('incidents.caseFile.reportedAs', {
              priority: t(`common.priority.${incident.reportedPriority}`).toLowerCase(),
              category: incident.reportedCategory.name,
            })}
          </Row>
        )}
        <Row label={t('incidents.caseFile.reporter')}>{incident.reporter.name}</Row>
        {incident.reporterPhone && (
          <Row label={t('incidents.caseFile.phone')}>
            <a className="text-accent hover:underline" href={`tel:${incident.reporterPhone}`}>
              {incident.reporterPhone}
            </a>
          </Row>
        )}
      </dl>

      {live && (
        <section className="rounded-lg border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">{t('incidents.caseFile.assignment')}</h3>
          <div className="flex items-center gap-3">
            <Avatar name={live.intervenant.name} />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">{live.intervenant.name}</p>
              <p className="text-ink-3">
                {[live.intervenant.companyName, t(`common.assignmentStatus.${live.status}`)]
                  .filter(Boolean)
                  .join(' - ')}
              </p>
            </div>
            {live.intervenant.phone && (
              <a
                className="ml-auto shrink-0 text-sm text-accent hover:underline"
                href={`tel:${live.intervenant.phone}`}
              >
                {live.intervenant.phone}
              </a>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {t('incidents.caseFile.assignedBy', { name: live.assignedBy.name })}
          </p>
          {live.note && (
            <p className="mt-3 border-l-2 border-dashed border-line-strong pl-3 text-sm text-ink-2">
              <span className="block text-xs text-ink-3">{t('incidents.caseFile.note')}</span>
              {live.note}
            </p>
          )}
          {live.reassignment && (
            <p className="mt-3 rounded-md bg-medium-subtle px-3 py-2 text-sm text-ink">
              <span className="block text-xs font-medium text-medium-ink">
                {t('incidents.caseFile.reassignmentRequest')}:{' '}
                {t(`common.reassignmentReason.${live.reassignment.reasonCode}`)}
              </span>
              {live.reassignment.note}
            </p>
          )}
        </section>
      )}

      {incident.resolutionNote && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">{t('incidents.caseFile.resolution')}</h3>
          <p className="border-l-2 border-success pl-3 text-sm whitespace-pre-line text-ink-2">
            {incident.resolutionNote}
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('incidents.caseFile.timeline')}</h3>
        <dl className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <Row label={t('incidents.caseFile.reported')}>{date(incident.createdAt, 'datetime')}</Row>
          {timeline
            .filter(([, iso]) => iso)
            .map(([label, iso]) => (
              <Row key={label} label={label}>
                {after(iso)}
              </Row>
            ))}
        </dl>
      </section>
    </div>
  );
}
