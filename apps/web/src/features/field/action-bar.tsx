import type { IncidentDetail } from '@sentinel/shared';
import { MoreHorizontal, Repeat } from 'lucide-react';
import { useState } from 'react';
import { StatusIcon } from '../../components/domain/glyphs';
import { Button, IconButton } from '../../components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../components/ui/menu';
import { useT, type Formatter } from '../../i18n';
import { useIncidentAction } from '../../lib/incidents';
import { DeclineSheet, ReassignSheet } from './assignment-forms';
import { BottomBar } from './parts';
import { ProgressSheet, ResolveSheet } from './work-forms';

/** A calm sentence about where the incident stands, for anyone with nothing to do on it. */
function statusText(incident: IncidentDetail, { t, date }: Formatter) {
  const name = incident.liveAssignment?.intervenant.name ?? incident.assignee?.name ?? '';
  switch (incident.status) {
    case 'NEW':
      return t('field.statusLine.NEW');
    case 'ASSIGNED':
      return t('field.statusLine.ASSIGNED', { name });
    case 'IN_PROGRESS':
      return t('field.statusLine.IN_PROGRESS', { name });
    case 'RESOLVED':
      return t('field.statusLine.RESOLVED');
    case 'CLOSED': {
      const when = date(incident.closedAt ?? incident.updatedAt, 'date');
      return incident.dismissReason
        ? t('field.statusLine.DISMISSED', { date: when, reason: t(`common.dismissReason.${incident.dismissReason}`) })
        : t('field.statusLine.CLOSED', { date: when });
    }
  }
}

function StatusLine({ incident }: { incident: IncidentDetail }) {
  const f = useT();
  return (
    <BottomBar>
      <p role="status" className="flex min-h-12 flex-1 items-center gap-2.5 text-md text-ink-2">
        <StatusIcon status={incident.status} className="size-5" />
        <span>{statusText(incident, f)}</span>
      </p>
    </BottomBar>
  );
}

/** A new assignment: accept starts the work, decline asks why. */
function AnswerBar({ incident, assignmentId }: { incident: IncidentDetail; assignmentId: string }) {
  const { t } = useT();
  const accept = useIncidentAction();
  const [declining, setDeclining] = useState(false);
  return (
    <BottomBar label={t('field.incident.actionsRegion')}>
      {incident.actions.includes('decline') && (
        <Button size="xl" className="px-4" disabled={accept.isPending} onClick={() => setDeclining(true)}>
          {t('field.actions.decline')}
        </Button>
      )}
      <Button
        variant="primary"
        size="xl"
        className="flex-1"
        loading={accept.isPending}
        onClick={() => accept.mutate({ path: `/assignments/${assignmentId}/accept`, success: t('field.actions.accepted') })}
      >
        {t('field.actions.accept')}
      </Button>
      <DeclineSheet open={declining} onOpenChange={setDeclining} assignmentId={assignmentId} />
    </BottomBar>
  );
}

type WorkSheet = 'resolve' | 'progress' | 'reassign' | null;

/** Work in progress: resolve is the primary action, updates and reassignment sit beside it. */
function WorkBar({ incident, assignmentId }: { incident: IncidentDetail; assignmentId: string }) {
  const { t } = useT();
  const [sheet, setSheet] = useState<WorkSheet>(null);
  const toggle = (name: Exclude<WorkSheet, null>) => (open: boolean) => setSheet(open ? name : null);
  const canReassign = incident.actions.includes('request-reassignment');
  const canProgress = incident.actions.includes('progress');

  return (
    <BottomBar label={t('field.incident.actionsRegion')}>
      {canReassign && (
        // Non-modal so the sheet opened from the item takes focus cleanly.
        <Menu modal={false}>
          <MenuTrigger asChild>
            <IconButton label={t('field.actions.more')} variant="secondary" size="xl" tooltip={false}>
              <MoreHorizontal className="size-5" />
            </IconButton>
          </MenuTrigger>
          <MenuContent side="top" className="min-w-60 [&_[role=menuitem]]:h-12 [&_[role=menuitem]]:text-md">
            <MenuItem icon={<Repeat />} onSelect={() => setSheet('reassign')}>
              {t('field.actions.requestReassignment')}
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
      {canProgress && (
        <Button size="xl" className="px-4" onClick={() => setSheet('progress')}>
          {t('field.actions.postUpdate')}
        </Button>
      )}
      <Button variant="primary" size="xl" className="flex-1" onClick={() => setSheet('resolve')}>
        {t('field.actions.resolve')}
      </Button>

      <ResolveSheet open={sheet === 'resolve'} onOpenChange={toggle('resolve')} incident={incident} assignmentId={assignmentId} />
      {canProgress && (
        <ProgressSheet open={sheet === 'progress'} onOpenChange={toggle('progress')} incident={incident} assignmentId={assignmentId} />
      )}
      {canReassign && <ReassignSheet open={sheet === 'reassign'} onOpenChange={toggle('reassign')} assignmentId={assignmentId} />}
    </BottomBar>
  );
}

/**
 * The bar fixed at the bottom of the incident screen, driven by the actions the
 * API computed for this viewer. Employees and anyone without a next step get a status line.
 */
export function IncidentActionBar({ incident }: { incident: IncidentDetail }) {
  const assignmentId = incident.liveAssignment?.id;
  if (assignmentId && incident.actions.includes('accept')) {
    return <AnswerBar incident={incident} assignmentId={assignmentId} />;
  }
  if (assignmentId && incident.actions.includes('resolve')) {
    return <WorkBar incident={incident} assignmentId={assignmentId} />;
  }
  return <StatusLine incident={incident} />;
}
