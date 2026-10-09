import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { meQueryKey, useMembership } from '../../app/session';
import { apiUrl } from '../../lib/api';

/**
 * Server-sent events. Supervisors listen to the active organization; employees and intervenants to every
 * organization they belong to (/me/events). An event only says "something changed for you", so every active
 * query except the session itself refetches. If the stream drops, EventSource retries and polling covers the gap.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const membership = useMembership();
  const url =
    membership.role === 'SUPERVISOR' ? apiUrl('/events', { org: membership.organization.id }) : apiUrl('/me/events');
  useEffect(() => {
    const source = new EventSource(url, { withCredentials: true });
    source.onmessage = () => {
      void queryClient.invalidateQueries({
        predicate: (query) => !(query.queryKey[0] === meQueryKey[0] && query.queryKey.length === 1),
      });
    };
    return () => source.close();
  }, [url, queryClient]);
}
