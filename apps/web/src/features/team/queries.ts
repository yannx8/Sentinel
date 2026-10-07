import type {
  ImportResult,
  InvitationDTO,
  inviteMemberSchema,
  InviteResult,
  MemberDTO,
  MembershipRole,
  MembershipStatus,
  SiteDTO,
  SpecialtyDTO,
  updateMemberSchema,
} from '@sentinel/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { meQueryKey } from '../../app/session';
import { api, ApiError, newIdempotencyKey } from '../../lib/api';
import { incidentKeys } from '../../lib/incidents';

export type MemberFilters = { q?: string; status?: MembershipStatus };
export type StatusAction = 'suspend' | 'reactivate' | 'revoke';

/** Every team query sits under 'team', so one invalidation refreshes lists, details and invitations. */
export const teamKeys = {
  all: ['team'] as const,
  lists: ['team', 'members'] as const,
  members: (role: MembershipRole, filters: MemberFilters) => ['team', 'members', role, filters] as const,
  member: (id: string) => ['team', 'member', id] as const,
  invitations: ['team', 'invitations'] as const,
};

/** Same keys as the other features that read these endpoints, so the cache is shared. */
export const catalogKeys = {
  sites: ['sites'] as const,
  specialties: ['specialties'] as const,
};

/** The dashboard's first-run checklist counts members and pending invitations. */
const setupChecklistKey = ['organization', 'setup'] as const;

const memberPath = (id: string, action?: string) => `/members/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;
const invitationPath = (id: string, action: string) => `/invitations/${encodeURIComponent(id)}/${action}`;

function refreshTeam(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: teamKeys.all });
  void queryClient.invalidateQueries({ queryKey: setupChecklistKey });
}

/** An intervenant losing access hands their live work back to the inbox. */
function refreshIncidents(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['incident'] });
  void queryClient.invalidateQueries({ queryKey: ['reassignments'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useMembers(role: MembershipRole, filters: MemberFilters) {
  return useQuery({
    queryKey: teamKeys.members(role, filters),
    queryFn: ({ signal }) =>
      api.get<MemberDTO[]>('/members', { query: { role, q: filters.q, status: filters.status }, signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** One member, shown at once from the row it was opened from, then refreshed. */
export function useMember(id: string | null, placeholder: MemberDTO | undefined) {
  return useQuery({
    queryKey: teamKeys.member(id ?? ''),
    queryFn: ({ signal }) => api.get<MemberDTO>(memberPath(id ?? ''), { signal }),
    enabled: !!id,
    placeholderData: placeholder,
  });
}

export function useInvitations() {
  return useQuery({
    queryKey: teamKeys.invitations,
    queryFn: ({ signal }) => api.get<InvitationDTO[]>('/invitations', { signal }),
    staleTime: 30_000,
  });
}

/** Every site of the organization, inactive ones included (supervisors only). */
export function useSites() {
  return useQuery({
    queryKey: catalogKeys.sites,
    queryFn: ({ signal }) => api.get<SiteDTO[]>('/sites', { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: catalogKeys.specialties,
    queryFn: ({ signal }) => api.get<SpecialtyDTO[]>('/specialties', { signal }),
    staleTime: 5 * 60_000,
  });
}

export type MemberUpdate = z.input<typeof updateMemberSchema>;
export type InviteInput = z.input<typeof inviteMemberSchema>;

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MemberUpdate }) => api.patch<MemberDTO>(memberPath(id), body),
    onSuccess: (member) => {
      queryClient.setQueryData(teamKeys.member(member.id), member);
      void queryClient.invalidateQueries({ queryKey: teamKeys.lists });
    },
  });
}

export function useChangeMemberStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ member, action, reason }: { member: MemberDTO; action: StatusAction; reason?: string }) =>
      api.post<MemberDTO>(memberPath(member.id, action), reason ? { reason } : {}, {
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: (updated, { member, action }) => {
      queryClient.setQueryData(teamKeys.member(updated.id), updated);
      if (action !== 'reactivate' && (member.intervenant?.liveAssignments ?? 0) > 0) refreshIncidents(queryClient);
    },
    onSettled: () => refreshTeam(queryClient),
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (member: MemberDTO) =>
      api.post<MemberDTO>(memberPath(member.id, 'transfer-ownership'), {}, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(teamKeys.member(updated.id), updated);
      // The session's own membership is no longer the owner.
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
    onSettled: () => refreshTeam(queryClient),
  });
}

export function useInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteInput) => api.post<InviteResult>('/invitations', input),
    onSuccess: () => refreshTeam(queryClient),
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InviteResult>(invitationPath(id, 'resend')),
    onSettled: () => refreshTeam(queryClient),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitation: InvitationDTO) =>
      api.post<InvitationDTO>(invitationPath(invitation.id, 'revoke'), {}, { idempotencyKey: newIdempotencyKey() }),
    onSettled: () => refreshTeam(queryClient),
  });
}

/** A dry run reports what would happen to each row. The real run reuses one key, so a retry never invites twice. */
export function useImportEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ csv, dryRun, idempotencyKey }: { csv: string; dryRun: boolean; idempotencyKey?: string }) =>
      api.post<ImportResult>('/members/import', { csv, dryRun }, { idempotencyKey }),
    onSuccess: (result) => {
      if (!result.dryRun) refreshTeam(queryClient);
    },
  });
}

/** The pending invitation named by a "pending invitation" conflict, so the dialog can offer to resend it. */
export function pendingInvitationId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'CONFLICT') return null;
  const details = error.details as { invitationId?: unknown } | undefined;
  return typeof details?.invitationId === 'string' ? details.invitationId : null;
}

/**
 * The same API error with its field paths renamed to match a form, for example
 * `employee.jobTitle` to `jobTitle` when the form edits the profile alone.
 */
export function renameFieldErrors(error: unknown, rename: (path: string) => string): unknown {
  if (!(error instanceof ApiError)) return error;
  const entries = Object.entries(error.fields);
  if (entries.length === 0) return error;
  const fields = Object.fromEntries(entries.map(([path, messages]) => [rename(path), messages]));
  const details = typeof error.details === 'object' && error.details !== null ? error.details : {};
  return new ApiError(
    { code: error.code, message: error.message, requestId: error.requestId, details: { ...details, fields } },
    error.status,
  );
}
