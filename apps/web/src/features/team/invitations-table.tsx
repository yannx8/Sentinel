import type { InvitationDTO, InviteResult } from '@sentinel/shared';
import { Ban, MoreHorizontal, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMembership } from '../../app/session';
import { IconButton } from '../../components/ui/button';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../components/ui/menu';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { toast } from '../../components/ui/toast';
import { Tooltip } from '../../components/ui/tooltip';
import { useT } from '../../i18n';
import { toastError } from '../../lib/forms';
import { InviteResultContent, InviteResultLoading } from './invite-result';
import { InvitationStatusBadge, NotSet, PersonCell, RelativeText, Text, fullName } from './parts';
import { useResendInvitation, useRevokeInvitation } from './queries';

/** Nobody has answered yet: the invitation can be sent again (and revoked while pending). */
const isOpen = (invitation: InvitationDTO) => invitation.status === 'PENDING' || invitation.status === 'EXPIRED';

/** Resend shows the new link; revoke asks first. Focus returns to the menu button after either dialog. */
function InvitationActions({ invitation }: { invitation: InvitationDTO }) {
  const { t } = useT();
  const membership = useMembership();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [resending, setResending] = useState<{ result: InviteResult | null } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Closing the dialog before the new link arrives keeps it closed.
  const waiting = useRef(false);
  const name = fullName(invitation);

  const restoreFocus = () => window.requestAnimationFrame(() => triggerRef.current?.focus());

  const startResend = () => {
    waiting.current = true;
    setResending({ result: null });
    resend.mutate(invitation.id, {
      onSuccess: (result) => {
        toast.success(t('team.invitations.resent', { name }));
        if (waiting.current) setResending({ result });
      },
      onError: (error) => {
        toastError(error, t);
        if (waiting.current) setResending(null);
        waiting.current = false;
      },
    });
  };

  const closeResend = () => {
    waiting.current = false;
    setResending(null);
    restoreFocus();
  };

  // Only the owner invites supervisors, so only the owner sends those invitations again.
  const resendBlocked = invitation.role === 'SUPERVISOR' && !membership.isOwner;
  const reason = t('team.invitations.ownerOnly');

  return (
    <>
      {isOpen(invitation) && (
        <Menu>
          <MenuTrigger asChild>
            <IconButton ref={triggerRef} label={t('team.invitations.menu', { name })} size="sm">
              <MoreHorizontal className="size-4" />
            </IconButton>
          </MenuTrigger>
          <MenuContent align="end">
            {resendBlocked ? (
              <MenuItem icon={<Send />} disabled>
                <Tooltip content={reason} side="left">
                  <span className="block truncate">
                    {t('team.invitations.resend')}
                    <span className="sr-only">. {reason}</span>
                  </span>
                </Tooltip>
              </MenuItem>
            ) : (
              <MenuItem icon={<Send />} onSelect={startResend}>
                {t('team.invitations.resend')}
              </MenuItem>
            )}
            {invitation.status === 'PENDING' && (
              <MenuItem icon={<Ban />} danger onSelect={() => setRevoking(true)}>
                {t('team.invitations.revoke')}
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      )}

      <Dialog open={resending !== null} onOpenChange={(next) => !next && closeResend()}>
        {resending &&
          (resending.result ? (
            <InviteResultContent result={resending.result} resent onDone={closeResend} />
          ) : (
            <InviteResultLoading email={invitation.email} />
          ))}
      </Dialog>

      <ConfirmDialog
        open={revoking}
        onOpenChange={(next) => {
          if (next) return;
          setRevoking(false);
          restoreFocus();
        }}
        title={t('team.invitations.revokeTitle', { name })}
        description={t('team.invitations.revokeBody', { email: invitation.email })}
        confirmLabel={t('team.invitations.revoke')}
        variant="danger"
        onConfirm={async () => {
          try {
            await revoke.mutateAsync(invitation);
            toast.success(t('team.invitations.revoked', { name }));
          } catch (error) {
            toastError(error, t);
          }
        }}
      />
    </>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, row) => (
        <Tr key={row}>
          <Td>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="grid gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          </Td>
          <Td className="hidden sm:table-cell">
            <Skeleton className="h-3.5 w-20" />
          </Td>
          <Td>
            <Skeleton className="h-3.5 w-16" />
          </Td>
          <Td className="hidden lg:table-cell">
            <Skeleton className="h-3.5 w-28" />
          </Td>
          <Td className="hidden md:table-cell">
            <Skeleton className="h-3.5 w-16" />
          </Td>
          <Td className="hidden md:table-cell">
            <Skeleton className="h-3.5 w-16" />
          </Td>
          <Td className="w-12" />
        </Tr>
      ))}
    </>
  );
}

/** Invitations, newest first. */
export function InvitationsTable({ invitations, loading }: { invitations: InvitationDTO[]; loading?: boolean }) {
  const { t } = useT();
  return (
    <Table>
      <caption className="sr-only">{t('team.tabs.invitations')}</caption>
      <THead>
        <tr>
          <Th>{t('team.columns.name')}</Th>
          <Th className="hidden sm:table-cell">{t('team.columns.role')}</Th>
          <Th>{t('team.columns.status')}</Th>
          <Th className="hidden lg:table-cell">{t('team.columns.invitedBy')}</Th>
          <Th className="hidden md:table-cell">{t('team.columns.sent')}</Th>
          <Th className="hidden md:table-cell">{t('team.columns.expires')}</Th>
          <Th className="w-12">
            <span className="sr-only">{t('team.columns.actions')}</span>
          </Th>
        </tr>
      </THead>
      <tbody>
        {loading ? (
          <SkeletonRows />
        ) : (
          invitations.map((invitation) => (
            <Tr key={invitation.id}>
              <Td className="py-1.5">
                <PersonCell name={fullName(invitation)} email={invitation.email} />
              </Td>
              <Td className="hidden whitespace-nowrap text-ink-2 sm:table-cell">
                {t(`common.role.${invitation.role}`)}
              </Td>
              <Td>
                <InvitationStatusBadge status={invitation.status} />
              </Td>
              <Td className="hidden lg:table-cell">
                <Text value={invitation.invitedBy?.name} className="max-w-48" />
              </Td>
              <Td className="hidden md:table-cell">
                <RelativeText iso={invitation.createdAt} />
              </Td>
              <Td className="hidden md:table-cell">
                {isOpen(invitation) ? <RelativeText iso={invitation.expiresAt} /> : <NotSet />}
              </Td>
              <Td className="w-12 text-right last:pr-2">
                <InvitationActions invitation={invitation} />
              </Td>
            </Tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
