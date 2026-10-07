import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { meQueryKey, useMembership } from '../../app/session';
import { apiUrl } from '../../lib/api';

/**
 * Server-sent events for the active organization. An event only says "something changed for you",
 * so every active query except the session refetches. If the stream drops, EventSource retries and
 * the 30 s polling in the notification bell covers the gap.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const orgId = useMembership().organization.id;
  useEffect(() => {
    const source = new EventSource(apiUrl('/events', { org: orgId }), { withCredentials: true });
    source.onmessage = () => {
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] });
    };
    return () => source.close();
  }, [orgId, queryClient]);
}
