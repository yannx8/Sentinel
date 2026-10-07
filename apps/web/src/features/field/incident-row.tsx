import type { IncidentListItem } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { MouseEvent } from 'react';
import { PriorityLabel, StatusLabel } from '../../components/domain/glyphs';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { useT } from '../../i18n';
import { Dot } from './parts';

/**
 * One tappable incident in a field list. Employees and history lead with the
 * status; My work leads with the priority, since that decides what to do first.
 */
export function IncidentRow({
  incident,
  lead,
  organization,
  showAssignee,
  onOpen,
}: {
  incident: IncidentListItem;
  lead: 'status' | 'priority';
  /** Organization name, shown when the person works for several. */
  organization?: string;
  showAssignee?: boolean;
  onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { t, relative, date } = useT();
  const { assignee } = incident;
  // Sent back and reassignment are between the intervenant and supervisors.
  const sentBack = lead === 'priority' && incident.flags.sentBack;
  const reassignment = lead === 'priority' && incident.flags.reassignmentRequested;
  return (
    <li>
      <Link
        to="/field/incidents/$reference"
        params={{ reference: incident.reference }}
        onClick={onOpen}
        className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle active:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            {lead === 'status' ? <StatusLabel status={incident.status} /> : <PriorityLabel priority={incident.priority} />}
            <time dateTime={incident.createdAt} title={date(incident.createdAt)} className="shrink-0 text-xs text-ink-3">
              {relative(incident.createdAt)}
            </time>
          </div>
          <p className="mt-1 line-clamp-2 text-md font-medium text-ink">{incident.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-3">
            <span className="tabular-nums">{incident.reference}</span>
            <Dot />
            <span>{incident.site.name}</span>
            {organization && (
              <>
                <Dot />
                <span className="font-medium text-ink-2">{organization}</span>
              </>
            )}
          </p>
          {(sentBack || reassignment || (showAssignee && assignee)) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {showAssignee && assignee && (
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
                  <Avatar name={assignee.name} size="xs" />
                  {assignee.name}
                </span>
              )}
              {sentBack && <Badge tone="critical">{t('field.list.sentBack')}</Badge>}
              {reassignment && <Badge tone="warning">{t('field.list.reassignmentRequested')}</Badge>}
            </div>
          )}
        </div>
        <ChevronRight className="mt-0.5 size-5 shrink-0 text-ink-4" aria-hidden />
      </Link>
    </li>
  );
}
