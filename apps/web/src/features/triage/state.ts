import type { Priority } from '@sentinel/shared';
import { categories, sites } from '../../data/seed';
import type { Incident } from '../../data/types';

export type ViewId = 'attention' | 'open' | 'review' | 'closed';

export const views: { id: ViewId; label: string }[] = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'open', label: 'All open' },
  { id: 'review', label: 'Awaiting review' },
  { id: 'closed', label: 'Closed' },
];

export const isViewId = (v: unknown): v is ViewId => views.some((x) => x.id === v);

export const effectivePriority = (i: Incident): Priority => i.priority ?? i.reportedPriority;
export const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? 'Unknown site';
export const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

const priorityWeight: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** True when the supervisor must act on it now. */
export const needsAttention = (i: Incident) => i.status === 'NEW' || i.status === 'RESOLVED' || i.reassignmentRequested !== null;

export function inView(i: Incident, view: ViewId): boolean {
  switch (view) {
    case 'attention':
      return needsAttention(i);
    case 'open':
      return i.status !== 'CLOSED';
    case 'review':
      return i.status === 'RESOLVED';
    case 'closed':
      return i.status === 'CLOSED';
  }
}

/** Needs attention: unowned and stuck first, then review. Within a group: priority, then longest waiting. */
export function sortForView(list: Incident[], view: ViewId): Incident[] {
  const group = (i: Incident) => (i.status === 'RESOLVED' ? 1 : 0);
  return [...list].sort((a, b) => {
    if (view === 'attention') {
      if (group(a) !== group(b)) return group(a) - group(b);
      const p = priorityWeight[effectivePriority(a)] - priorityWeight[effectivePriority(b)];
      if (p !== 0) return p;
      return a.createdAt - b.createdAt;
    }
    return b.createdAt - a.createdAt;
  });
}

export const matchesQuery = (i: Incident, q: string): boolean => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [i.reference, i.title, i.description, i.reporter, siteName(i.siteId)].some((f) => f.toLowerCase().includes(needle));
};

/** One plain sentence about where the incident stands. `live` marks "someone is waiting on a decision". */
export function stateSentence(i: Incident): { text: string; live: boolean } {
  if (i.reassignmentRequested) return { text: `${i.assignee?.name ?? 'The technician'} asked to be reassigned`, live: true };
  switch (i.status) {
    case 'NEW':
      return i.declined
        ? { text: `${i.declined.by} declined. Needs a new assignee`, live: true }
        : { text: 'Needs triage', live: true };
    case 'ASSIGNED':
      return { text: `Waiting for ${i.assignee?.name ?? 'the technician'} to accept`, live: true };
    case 'IN_PROGRESS':
      return { text: `${i.assignee?.name ?? 'A technician'} is working on it`, live: false };
    case 'RESOLVED':
      return { text: 'Resolved, waiting for your review', live: true };
    case 'CLOSED':
      return { text: 'Closed', live: false };
  }
}

/** Short marker shown under the title in list rows. */
export function rowMarker(i: Incident): string | null {
  if (i.reassignmentRequested) return 'Reassignment requested';
  if (i.declined) return `Declined by ${i.declined.by}`;
  switch (i.status) {
    case 'NEW':
      return 'Needs triage';
    case 'ASSIGNED':
      return `Waiting for ${i.assignee?.name ?? 'technician'}`;
    case 'IN_PROGRESS':
      return `With ${i.assignee?.name ?? 'technician'}`;
    case 'RESOLVED':
      return 'Awaiting review';
    case 'CLOSED':
      return null;
  }
}
