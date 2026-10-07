import type { OrganizationStatus } from '@sentinel/shared';
import { Badge, type Tone } from '../../components/ui/badge';
import { useT } from '../../i18n';

const tones: Record<OrganizationStatus, Tone> = { ACTIVE: 'success', SUSPENDED: 'critical', CLOSED: 'neutral' };

export function OrgStatusBadge({ status }: { status: OrganizationStatus }) {
  const { t } = useT();
  return <Badge tone={tones[status]}>{t(`common.orgStatus.${status}`)}</Badge>;
}

export function countryName(code: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
}
