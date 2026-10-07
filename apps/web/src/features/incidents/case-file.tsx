import type { IncidentDetail } from '@sentinel/shared';
import * as Tabs from '@radix-ui/react-tabs';
import { MoreHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PriorityLabel, StatusLabel } from '../../components/domain/glyphs';
import { Thread } from '../../components/domain/thread';
import { Badge } from '../../components/ui/badge';
import { Banner, Skeleton } from '../../components/ui/feedback';
import { Button, IconButton } from '../../components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../components/ui/menu';
import { Textarea } from '../../components/ui/input';
import { Segmented } from '../../components/ui/segmented';
import { useT } from '../../i18n';
import { resourceUrl } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useAddComment, useIncident, useThread } from '../../lib/incidents';
import { toast } from '../../components/ui/toast';
import { AssignDialog } from './assign-dialog';
import { CaseDetails } from './case-details';
import { CloseDialog, DismissDialog, SendBackDialog, TriageDialog, UnassignDialog } from './simple-dialogs';
import { FlagBadges } from './incident-list';

type Dialog = 'assign' | 'triage' | 'unassign' | 'send-back' | 'dismiss' | 'close' | null;

const tab =
  '-mb-px h-10 border-b-2 border-transparent text-sm font-medium text-ink-3 transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink';

function Composer({ incident }: { incident: IncidentDetail }) {
  const { t } = useT();
  const add = useAddComment(incident.reference);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'INTERNAL' | 'PUBLIC'>('INTERNAL');
  if (incident.status === 'CLOSED')
    return (
      <p className="rounded-md bg-subtle px-3 py-2 text-sm text-ink-3">{t('incidents.caseFile.comment.readOnly')}</p>
    );
  const send = () => {
    const text = body.trim();
    if (!text) return;
    add.mutate(
      { body: text, visibility },
      {
        onSuccess: () => {
          setBody('');
          toast.success(t('incidents.caseFile.comment.sent'));
        },
      },
    );
  };
  return (
    <div className="rounded-lg border border-line bg-surface p-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
      <label htmlFor="comment-body" className="sr-only">
        {t('thread.events.COMMENT_ADDED', { actor: '' })}
      </label>
      <Textarea
        id="comment-body"
        rows={2}
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={t(
          visibility === 'INTERNAL'
            ? 'incidents.caseFile.comment.placeholderInternal'
            : 'incidents.caseFile.comment.placeholderReply',
        )}
        className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label={t('incidents.caseFile.comment.visibility')}
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'INTERNAL', label: t('incidents.caseFile.comment.internal') },
            { value: 'PUBLIC', label: t('incidents.caseFile.comment.reply') },
          ]}
        />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-3 sm:block">{t('incidents.caseFile.comment.hint')}</span>
          <Button variant="primary" size="sm" disabled={!body.trim()} loading={add.isPending} onClick={send}>
            {t('incidents.caseFile.comment.send')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PhotoGrid({ incident }: { incident: IncidentDetail }) {
  const { t, date } = useT();
  if (incident.attachments.length === 0)
    return <p className="py-8 text-center text-sm text-ink-3">{t('incidents.caseFile.noPhotos')}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {incident.attachments.map((photo) => (
        <li key={photo.id}>
          <a
            href={resourceUrl(photo.url)}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-md border border-line"
          >
            <img
              src={resourceUrl(photo.url)}
              alt={photo.fileName}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </a>
          <p className="mt-1.5 truncate text-xs text-ink-3">
            {photo.uploadedBy.name}, {date(photo.createdAt, 'short')}
          </p>
        </li>
      ))}
    </ul>
  );
}

function waiting(incident: IncidentDetail, t: ReturnType<typeof useT>['t']) {
  const name = incident.liveAssignment?.intervenant.name ?? '';
  if (incident.liveAssignment?.status === 'REASSIGNMENT_REQUESTED')
    return t('incidents.caseFile.waiting.reassignment', { name });
  if (incident.status === 'ASSIGNED') return t('incidents.caseFile.waiting.acceptance', { name });
  if (incident.status === 'IN_PROGRESS') return t('incidents.caseFile.waiting.work', { name });
  return null;
}

export function CaseFile({
  reference,
  onClose,
  conflict,
}: {
  reference: string;
  onClose?: () => void;
  conflict?: boolean;
}) {
  const { t, date } = useT();
  const incident = useIncident(reference);
  const thread = useThread(reference);
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = incident.data;

  if (!data) {
    return (
      <div className="p-6" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-7 w-3/4" />
        <Skeleton className="mt-4 h-4 w-1/2" />
        <Skeleton className="mt-10 h-40 w-full" />
      </div>
    );
  }

  const can = (action: string) => (data.actions as string[]).includes(action);
  const wait = waiting(data, t);
  const open = (d: Dialog) => () => setDialog(d);
  const secondary: { key: Dialog; label: string; show: boolean; danger?: boolean }[] = [
    { key: 'triage', label: t('incidents.actions.triage'), show: can('triage') && !can('assign') },
    { key: 'unassign', label: t('incidents.actions.unassign'), show: can('unassign') },
    { key: 'dismiss', label: t('incidents.actions.dismiss'), show: can('dismiss'), danger: true },
  ];
  const menuItems = secondary.filter((item) => item.show);

  let primary: ReactNode = null;
  if (can('assign'))
    primary = (
      <Button variant="primary" data-case-primary onClick={open('assign')}>
        {t(data.triaged ? 'incidents.actions.assign' : 'incidents.actions.triageAssign')}
      </Button>
    );
  else if (can('reassign'))
    primary = (
      <Button variant="primary" data-case-primary onClick={open('assign')}>
        {t('incidents.actions.reassign')}
      </Button>
    );
  else if (can('close'))
    primary = (
      <Button variant="primary" onClick={open('close')}>
        {t('incidents.actions.close')}
      </Button>
    );
  const sendBack = can('send-back') ? (
    <Button onClick={open('send-back')}>{t('incidents.actions.sendBack')}</Button>
  ) : null;
  const triageButton = can('assign') ? <Button onClick={open('triage')}>{t('incidents.actions.triage')}</Button> : null;
  const overflow = can('assign') ? menuItems.filter((m) => m.key !== 'triage') : menuItems;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-line px-5 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <span className="tabular-nums">{data.reference}</span>
            <span>{data.site.name}</span>
          </p>
          {onClose && (
            <IconButton label={t('incidents.closeCaseFile')} size="sm" className="-mt-1 -mr-1.5" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          )}
        </div>
        <h2 className="mt-1 text-xl font-semibold text-ink">{data.title}</h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <StatusLabel status={data.status} />
          <span className="inline-flex items-center gap-1.5">
            <PriorityLabel priority={data.priority} />
            {!data.triaged && <span className="text-xs text-ink-3">({t('incidents.suggested')})</span>}
          </span>
          <span className="text-sm text-ink-3">{t('incidents.caseFile.reportedBy', { name: data.reporter.name })}</span>
          <FlagBadges item={data} />
        </div>
        {data.status === 'CLOSED' ? (
          <p className="mt-4 text-sm text-ink-3">
            {data.closedAt && t('incidents.caseFile.closedOn', { date: date(data.closedAt, 'datetime') })}
            {data.dismissReason && (
              <span className="ml-1">
                {t('incidents.caseFile.dismissedAs', {
                  reason: t(`common.dismissReason.${data.dismissReason}`).toLowerCase(),
                })}
              </span>
            )}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {primary}
            {triageButton}
            {sendBack}
            {overflow.length > 0 && (
              <Menu>
                <MenuTrigger asChild>
                  <IconButton label={t('incidents.actions.more')} variant="secondary">
                    <MoreHorizontal className="size-4" />
                  </IconButton>
                </MenuTrigger>
                <MenuContent align="start">
                  {overflow.map((item) => (
                    <MenuItem key={item.key} danger={item.danger} onSelect={open(item.key)}>
                      {item.label}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            )}
            {wait && <span className="ml-1 text-sm text-ink-3">{wait}</span>}
          </div>
        )}
      </header>

      {conflict && (
        <Banner tone="warning" className="mx-5 mt-4">
          {t('incidents.caseFile.conflict')}
        </Banner>
      )}

      <Tabs.Root defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="flex shrink-0 gap-5 border-b border-line px-5">
          <Tabs.Trigger value="activity" className={tab}>
            {t('incidents.caseFile.activity')}
          </Tabs.Trigger>
          <Tabs.Trigger value="details" className={tab}>
            {t('incidents.caseFile.details')}
          </Tabs.Trigger>
          <Tabs.Trigger value="photos" className={cn(tab, 'flex items-center gap-1.5')}>
            {t('incidents.caseFile.photos')}
            {data.attachments.length > 0 && <Badge className="h-4">{data.attachments.length}</Badge>}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="activity" className="min-h-0 flex-1 overflow-y-auto px-5 py-5 focus:outline-none">
          {thread.data ? <Thread events={thread.data} incident={data} /> : <Skeleton className="h-40 w-full" />}
          <div className="mt-6">
            <Composer incident={data} />
          </div>
        </Tabs.Content>
        <Tabs.Content value="details" className="min-h-0 flex-1 overflow-y-auto px-5 py-5 focus:outline-none">
          <CaseDetails incident={data} />
        </Tabs.Content>
        <Tabs.Content value="photos" className="min-h-0 flex-1 overflow-y-auto px-5 py-5 focus:outline-none">
          <PhotoGrid incident={data} />
        </Tabs.Content>
      </Tabs.Root>

      <AssignDialog incident={data} open={dialog === 'assign'} onOpenChange={(o) => setDialog(o ? 'assign' : null)} />
      <TriageDialog incident={data} open={dialog === 'triage'} onOpenChange={(o) => setDialog(o ? 'triage' : null)} />
      <UnassignDialog
        incident={data}
        open={dialog === 'unassign'}
        onOpenChange={(o) => setDialog(o ? 'unassign' : null)}
      />
      <SendBackDialog
        incident={data}
        open={dialog === 'send-back'}
        onOpenChange={(o) => setDialog(o ? 'send-back' : null)}
      />
      <DismissDialog
        incident={data}
        open={dialog === 'dismiss'}
        onOpenChange={(o) => setDialog(o ? 'dismiss' : null)}
      />
      <CloseDialog incident={data} open={dialog === 'close'} onOpenChange={(o) => setDialog(o ? 'close' : null)} />
    </div>
  );
}
