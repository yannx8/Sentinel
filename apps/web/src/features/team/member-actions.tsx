import type { MemberDTO, MembershipSummary } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { CirclePause, CirclePlay, Crown, MoreHorizontal, Send, UserX } from 'lucide-react';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { useMembership } from '../../app/session';
import { IconButton } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/dialog';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../../components/ui/menu';
import { toast } from '../../components/ui/toast';
import { Tooltip } from '../../components/ui/tooltip';
import { useT, type TKey } from '../../i18n';
import { toastError } from '../../lib/forms';
import { draftFromMember, type InviteDraft } from './invite-dialog';
import { fullName } from './parts';
import { usePlural } from './plural';
import { useChangeMemberStatus, useTransferOwnership, type StatusAction } from './queries';

type ActionKey = StatusAction | 'transfer' | 'inviteAgain';
type Action = { key: ActionKey; blockedBy?: TKey };

/**
 * What the active membership may do to `member`, mirroring the API rules:
 * nobody changes their own access, only the owner changes a supervisor's,
 * an owner keeps access until ownership moves, and ownership goes to an active supervisor.
 */
export function memberActions(member: MemberDTO, me: MembershipSummary): Action[] {
  if (member.id === me.id) return [];
  const supervisor = member.role === 'SUPERVISOR';
  const ownerOnly: TKey | undefined = supervisor && !me.isOwner ? 'team.actions.ownerOnly' : undefined;
  // The owner's own rule comes first: it holds for every viewer, owner or not.
  const removal: TKey | undefined = member.isOwner ? 'team.actions.ownerLocked' : ownerOnly;
  const actions: Action[] = [];
  if (member.status === 'ACTIVE') actions.push({ key: 'suspend', blockedBy: removal });
  if (member.status === 'SUSPENDED') actions.push({ key: 'reactivate', blockedBy: ownerOnly });
  if (me.isOwner && supervisor && !member.isOwner && member.status !== 'REVOKED') {
    actions.push({
      key: 'transfer',
      blockedBy: member.status === 'ACTIVE' ? undefined : 'team.actions.transferActiveOnly',
    });
  }
  if (member.status !== 'REVOKED') actions.push({ key: 'revoke', blockedBy: removal });
  if (member.status === 'REVOKED' && !ownerOnly) actions.push({ key: 'inviteAgain' });
  return actions;
}

const actionIcons: Record<ActionKey, ReactNode> = {
  suspend: <CirclePause />,
  reactivate: <CirclePlay />,
  revoke: <UserX />,
  transfer: <Crown />,
  inviteAgain: <Send />,
};

/**
 * A blocked action stays visible, disabled, with its reason in a tooltip. A
 * disabled item cannot hold focus, so the reason is also part of its text for
 * screen readers. When the menu already states the reason, the item stays plain.
 */
function ActionItem({ action, explained, onSelect }: { action: Action; explained: boolean; onSelect: () => void }) {
  const { t } = useT();
  const label = t(`team.actions.${action.key}`);
  if (action.blockedBy) {
    const reason = t(action.blockedBy);
    return (
      <MenuItem icon={actionIcons[action.key]} disabled>
        {explained ? (
          label
        ) : (
          <Tooltip content={reason} side="left">
            <span className="block truncate">
              {label}
              <span className="sr-only">. {reason}</span>
            </span>
          </Tooltip>
        )}
      </MenuItem>
    );
  }
  return (
    <MenuItem icon={actionIcons[action.key]} danger={action.key === 'revoke'} onSelect={onSelect}>
      {label}
    </MenuItem>
  );
}

function StatusConfirm({
  member,
  action,
  onClose,
}: {
  member: MemberDTO;
  action: StatusAction | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const tn = usePlural();
  const membership = useMembership();
  const change = useChangeMemberStatus();
  const [reason, setReason] = useState('');
  const shown = action ?? 'suspend';
  const live = member.intervenant?.liveAssignments ?? 0;
  const vars = { name: member.firstName, organization: membership.organization.displayName };
  const handBack = shown !== 'reactivate' && live > 0 ? ` ${tn('team.confirm.liveReturn', live)}` : '';

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (open) return;
        setReason('');
        onClose();
      }}
      title={t(`team.confirm.${shown}.title`, { name: fullName(member) })}
      description={t(`team.confirm.${shown}.body`, vars) + handBack}
      confirmLabel={t(`team.confirm.${shown}.confirm`)}
      variant={shown === 'reactivate' ? 'primary' : 'danger'}
      onConfirm={async () => {
        try {
          await change.mutateAsync({ member, action: shown, reason: reason.trim() || undefined });
          toast.success(t(`team.confirm.${shown}.done`, { name: fullName(member) }));
        } catch (error) {
          toastError(error, t);
        }
      }}
    >
      {shown !== 'reactivate' && (
        <div className="grid gap-3">
          {live > 0 && (
            // The other way out: hand each incident to someone chosen, before access ends.
            <p className="text-sm text-ink-2">
              {t('team.confirm.reassignFirst')}{' '}
              <Link
                to="/app/incidents"
                search={{ assignee: member.id }}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                {tn('team.confirm.openIncidents', live)}
              </Link>
            </p>
          )}
          <Field label={t('team.confirm.reason')} optional hint={t('team.confirm.reasonHint')}>
            <Textarea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
      )}
    </ConfirmDialog>
  );
}

function TransferConfirm({ member, open, onClose }: { member: MemberDTO; open: boolean; onClose: () => void }) {
  const { t } = useT();
  const membership = useMembership();
  const transfer = useTransferOwnership();
  const name = fullName(member);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('team.confirm.transfer.title', { name })}
      description={t('team.confirm.transfer.body', { name, organization: membership.organization.displayName })}
      confirmLabel={t('team.confirm.transfer.confirm')}
      onConfirm={async () => {
        try {
          await transfer.mutateAsync(member);
          toast.success(t('team.confirm.transfer.done', { name }));
        } catch (error) {
          toastError(error, t);
        }
      }}
    />
  );
}

/**
 * The actions menu for one member, in a table row or the member sheet. Each
 * change goes through a dialog that names the person and the consequence.
 */
export function MemberActions({
  member,
  onInviteAgain,
}: {
  member: MemberDTO;
  onInviteAgain: (draft: InviteDraft) => void;
}) {
  const { t } = useT();
  const membership = useMembership();
  const [status, setStatus] = useState<StatusAction | null>(null);
  const [transfer, setTransfer] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actions = memberActions(member, membership);
  if (actions.length === 0) return null;
  // Every action blocked for the same reason: the menu says it once, at the top.
  const firstReason = actions[0]?.blockedBy;
  const sharedReason =
    firstReason && actions.every((action) => action.blockedBy === firstReason) ? firstReason : undefined;

  // The dialogs open from a menu that is gone when they close, so focus goes back to its trigger.
  const restoreFocus = () => window.requestAnimationFrame(() => triggerRef.current?.focus());

  const select = (key: ActionKey) => {
    if (key === 'transfer') setTransfer(true);
    else if (key === 'inviteAgain') onInviteAgain(draftFromMember(member));
    else setStatus(key);
  };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton ref={triggerRef} label={t('team.actions.menu', { name: fullName(member) })} size="sm">
            <MoreHorizontal className="size-4" />
          </IconButton>
        </MenuTrigger>
        <MenuContent align="end">
          {sharedReason && (
            <MenuLabel>
              <span className="block max-w-56 font-normal">{t(sharedReason)}</span>
            </MenuLabel>
          )}
          {actions.map((action) => (
            <Fragment key={action.key}>
              {action.key === 'revoke' && actions.length > 1 && !sharedReason && <MenuSeparator />}
              <ActionItem action={action} explained={!!sharedReason} onSelect={() => select(action.key)} />
            </Fragment>
          ))}
        </MenuContent>
      </Menu>
      <StatusConfirm
        member={member}
        action={status}
        onClose={() => {
          setStatus(null);
          restoreFocus();
        }}
      />
      <TransferConfirm
        member={member}
        open={transfer}
        onClose={() => {
          setTransfer(false);
          restoreFocus();
        }}
      />
    </>
  );
}
