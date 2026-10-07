import type { MemberDTO, MembershipRole, MembershipStatus } from '@sentinel/shared';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Search, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/layout';
import { Select } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useT } from '../../i18n';
import { ImportDialog } from './import-dialog';
import { InviteDialog, type InviteDraft } from './invite-dialog';
import { InviteMenu } from './invite-menu';
import { MemberSheet } from './member-sheet';
import { useInvitations, useMembers } from './queries';
import { InvitationsPanel, MembersPanel } from './team-panels';

type Tab = 'employees' | 'intervenants' | 'supervisors' | 'invitations';
type MemberTab = Exclude<Tab, 'invitations'>;
type SearchPatch = { tab?: Tab; q?: string; status?: MembershipStatus };

const memberTabs: { tab: MemberTab; role: MembershipRole }[] = [
  { tab: 'employees', role: 'REPORTER' },
  { tab: 'intervenants', role: 'INTERVENANT' },
  { tab: 'supervisors', role: 'SUPERVISOR' },
];

const isTab = (value: string): value is Tab =>
  value === 'employees' || value === 'intervenants' || value === 'supervisors' || value === 'invitations';

/** Default value of the status filter: the API then lists active and suspended members. */
const CURRENT = 'current';

function Toolbar({
  tab,
  q,
  status,
  onChange,
}: {
  tab: Tab;
  q: string | undefined;
  status: MembershipStatus | undefined;
  onChange: (patch: SearchPatch) => void;
}) {
  const { t } = useT();
  const [value, setValue] = useState(q ?? '');
  // The last search this field wrote to the URL, so its own updates never overwrite what is being typed.
  const written = useRef(q);

  // Follows the URL when it changes from elsewhere, such as a search from the command palette.
  useEffect(() => {
    if (q === written.current) return;
    written.current = q;
    setValue(q ?? '');
  }, [q]);

  useEffect(() => {
    const next = value.trim() ? value : undefined;
    if ((next ?? '') === (q ?? '')) return;
    const timer = window.setTimeout(() => {
      written.current = next;
      onChange({ q: next });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [value, q, onChange]);

  const statusOptions = [
    { value: CURRENT, label: t('team.filters.current') },
    { value: 'ACTIVE', label: t('common.memberStatus.ACTIVE') },
    { value: 'SUSPENDED', label: t('common.memberStatus.SUSPENDED') },
    { value: 'REVOKED', label: t('common.memberStatus.REVOKED') },
  ];

  return (
    <div role="search" className="mt-4 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Field label={t('team.filters.search')} hideLabel className="sm:w-80">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value) {
              event.preventDefault();
              setValue('');
            }
          }}
          placeholder={tab === 'invitations' ? t('team.filters.searchInvitations') : t('team.filters.searchMembers')}
          leading={<Search />}
          trailing={
            value ? (
              <button
                type="button"
                onClick={() => setValue('')}
                aria-label={t('team.filters.clearSearch')}
                className="pointer-events-auto flex rounded-xs p-0.5 text-ink-3 hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : undefined
          }
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={100}
        />
      </Field>
      {tab !== 'invitations' && (
        <Field label={t('team.filters.status')} hideLabel className="sm:w-52">
          <Select
            value={status ?? CURRENT}
            onValueChange={(next) => onChange({ status: next === CURRENT ? undefined : (next as MembershipStatus) })}
            options={statusOptions}
          />
        </Field>
      )}
    </div>
  );
}

/**
 * Team: employees, intervenants, supervisors and invitations. The tab, the
 * search and the status filter live in the URL, so every view can be shared.
 */
export function TeamPage() {
  const { t } = useT();
  const search = useSearch({ from: '/app/team' });
  const navigate = useNavigate({ from: '/app/team' });
  const tab: Tab = search.tab ?? 'employees';
  const q = search.q?.trim() || undefined;
  const filters = { q, status: search.status };
  const filtered = !!q || !!search.status;

  const employees = useMembers('REPORTER', filters);
  const intervenants = useMembers('INTERVENANT', filters);
  const supervisors = useMembers('SUPERVISOR', filters);
  const lists = { employees, intervenants, supervisors };
  const invitations = useInvitations();

  const [invite, setInvite] = useState<InviteDraft | null>(null);
  const [importing, setImporting] = useState(false);
  const [opened, setOpened] = useState<MemberDTO | null>(null);

  const update = useCallback(
    (patch: SearchPatch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  const clearFilters = () => update({ q: undefined, status: undefined });
  const startInvite = (role: MembershipRole) => setInvite({ role });
  const inviteAgain = (draft: InviteDraft) => {
    setOpened(null);
    setInvite(draft);
  };
  const pending = invitations.data?.filter((invitation) => invitation.status === 'PENDING').length;

  return (
    <Page>
      <PageHeader
        title={t('team.title')}
        description={t('team.description')}
        actions={
          <>
            <Button icon={<Upload className="size-4" aria-hidden />} onClick={() => setImporting(true)}>
              {t('team.actions.importEmployees')}
            </Button>
            <InviteMenu onSelect={startInvite} />
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isTab(value)) update({ tab: value === 'employees' ? undefined : value });
        }}
      >
        {/* Scrolls sideways on phones. The padding keeps the focus ring of the tabs inside the scroll box. */}
        <div className="-mx-4 -my-1 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-1 sm:px-1">
          <TabsList className="w-max min-w-full">
            {memberTabs.map(({ tab: value }) => (
              <TabsTrigger key={value} value={value} count={lists[value].data?.length}>
                {t(`team.tabs.${value}`)}
              </TabsTrigger>
            ))}
            <TabsTrigger value="invitations" count={pending}>
              {t('team.tabs.invitations')}
            </TabsTrigger>
          </TabsList>
        </div>

        <Toolbar tab={tab} q={search.q} status={search.status} onChange={update} />

        {memberTabs.map(({ tab: value, role }) => (
          <TabsContent key={value} value={value}>
            <MembersPanel
              key={`${q ?? ''}|${search.status ?? ''}`}
              role={role}
              query={lists[value]}
              filtered={filtered}
              onOpen={setOpened}
              onInvite={startInvite}
              onInviteAgain={inviteAgain}
              onClear={clearFilters}
            />
          </TabsContent>
        ))}
        <TabsContent value="invitations">
          <InvitationsPanel query={invitations} q={q} onInvite={startInvite} onClear={() => update({ q: undefined })} />
        </TabsContent>
      </Tabs>

      {invite && <InviteDialog draft={invite} onClose={() => setInvite(null)} />}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onViewInvitations={() => {
            setImporting(false);
            update({ tab: 'invitations', q: undefined });
          }}
        />
      )}
      <MemberSheet member={opened} onClose={() => setOpened(null)} onInviteAgain={inviteAgain} />
    </Page>
  );
}
