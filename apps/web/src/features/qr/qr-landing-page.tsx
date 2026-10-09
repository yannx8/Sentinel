import type { PublicSiteDTO } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from '@tanstack/react-router';
import { Link2Off } from 'lucide-react';
import { useEffect } from 'react';
import { useSession } from '../../app/session';
import { buttonClass } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { AuthStatus } from '../auth/parts';
import { GuestReportForm } from './guest-report-form';

/**
 * A printed QR code lands here. A signed-in member of the site's organization goes straight to the
 * report form with the site and area filled in; anyone else is asked to sign in first.
 */
export function QrLandingPage() {
  const { t } = useT();
  const { token } = useParams({ from: '/public/r/$token' });
  const { me, membership, loading, switchOrganization } = useSession();
  const site = useQuery({
    queryKey: ['public-site', token],
    queryFn: ({ signal }) => api.get<PublicSiteDTO>(`/public/sites/${token}`, { signal }),
    retry: false,
  });
  const data = site.data;
  const member = !!data && !!me?.memberships.some((m) => m.organization.id === data.organizationId);
  const inOrg = membership?.organization.id === data?.organizationId;

  useEffect(() => {
    if (data && member && !inOrg) switchOrganization(data.organizationId);
  }, [data, member, inOrg, switchOrganization]);

  if (site.isPending || loading) return <Skeleton className="h-40 w-full max-w-[400px]" />;

  if (site.isError || !data) {
    return (
      <AuthStatus icon={<Link2Off />} title={t('field.qr.invalidTitle')}>
        <p>{t('field.qr.invalidBody')}</p>
      </AuthStatus>
    );
  }

  if (member && inOrg) {
    return <Navigate to="/field/report" search={{ site: data.siteId, area: data.areaId ?? undefined }} replace />;
  }

  if (me && !member) {
    return (
      <AuthStatus icon={<Link2Off />} title={t('field.qr.notMemberTitle', { organization: data.organizationName })}>
        <p>{t('field.qr.notMemberBody')}</p>
      </AuthStatus>
    );
  }

  if (!me && data.guestReporting) {
    return (
      <div className="grid justify-items-center gap-3">
        <GuestReportForm token={token} site={data} />
        <Link
          to="/login"
          search={{ redirect: `/r/${token}`, email: undefined }}
          className="pb-6 text-sm font-medium text-accent hover:underline"
        >
          {t('field.qr.signInInstead', { organization: data.organizationName })}
        </Link>
      </div>
    );
  }

  return (
    <AuthStatus icon={<Link2Off />} title={t('field.qr.signInTitle', { site: data.areaName ?? data.siteName })}>
      <p>{t('field.qr.signInBody', { organization: data.organizationName })}</p>
      <Link
        to="/login"
        search={{ redirect: `/r/${token}`, email: undefined }}
        className={buttonClass({ variant: 'primary', size: 'lg' })}
      >
        {t('field.qr.signIn')}
      </Link>
    </AuthStatus>
  );
}
