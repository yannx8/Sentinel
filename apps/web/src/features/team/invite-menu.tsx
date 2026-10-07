import type { MembershipRole } from '@sentinel/shared';
import { ChevronDown, ShieldCheck, UserPlus, UserRound, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMembership } from '../../app/session';
import { Button, type ButtonVariant } from '../../components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '../../components/ui/menu';
import { useT } from '../../i18n';

const roleIcons: Record<MembershipRole, ReactNode> = {
  REPORTER: <UserRound />,
  INTERVENANT: <Wrench />,
  SUPERVISOR: <ShieldCheck />,
};

/** Roles the active membership may invite. Only the owner invites supervisors. */
export function useInvitableRoles(): MembershipRole[] {
  const membership = useMembership();
  return membership.isOwner ? ['REPORTER', 'INTERVENANT', 'SUPERVISOR'] : ['REPORTER', 'INTERVENANT'];
}

/** "Invite" opens a short menu to choose the role, then the matching form. */
export function InviteMenu({
  onSelect,
  variant = 'primary',
  align = 'end',
}: {
  onSelect: (role: MembershipRole) => void;
  variant?: ButtonVariant;
  align?: 'start' | 'center' | 'end';
}) {
  const { t } = useT();
  const roles = useInvitableRoles();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant={variant}
          icon={<UserPlus className="size-4" aria-hidden />}
          trailing={<ChevronDown className="size-3.5 opacity-70" aria-hidden />}
        >
          {t('team.actions.invite')}
        </Button>
      </MenuTrigger>
      <MenuContent align={align} className="w-56">
        <MenuLabel>{t('team.actions.inviteAs')}</MenuLabel>
        {roles.map((role) => (
          <MenuItem key={role} icon={roleIcons[role]} onSelect={() => onSelect(role)}>
            {t(`common.role.${role}`)}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
