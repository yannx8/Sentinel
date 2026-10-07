import {
  attachmentKinds,
  dismissReasons,
  membershipRoles,
  priorities,
  progressTypes,
  reassignmentReasons,
  type AuditEntryDTO,
} from '@sentinel/shared';
import { useCallback } from 'react';
import { useT } from '../../i18n';
import { usePlural } from './plural';

type Payload = Record<string, unknown>;

function text(payload: Payload, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function record(payload: Payload, key: string): Payload | null {
  const value = payload[key];
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Payload) : null;
}

/** Name of a PersonRef stored in the payload. */
function person(payload: Payload, key: string): string | null {
  const value = record(payload, key);
  return value ? text(value, 'name') : null;
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Collapses whitespace so a long note fits on one line. */
function oneLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * One readable line for an audit entry, built from its payload. Unknown or
 * partial payloads fall back to an empty string; the full JSON stays one click away.
 */
export function useAuditSummary() {
  const { t, locale } = useT();
  const tn = usePlural();

  return useCallback(
    (entry: AuditEntryDTO): string => {
      const p = entry.payload;
      const name = text(p, 'name') ?? '';
      const lower = (value: string) => value.toLocaleLowerCase(locale);
      const role = oneOf(membershipRoles, p.role) ? lower(t(`common.role.${p.role}`)) : '';
      const priority = (value: unknown) => (oneOf(priorities, value) ? t(`common.priority.${value}`) : '');
      const withNote = (summary: string, note: string | null) =>
        note ? t('audit.details.withNote', { summary, note: oneLine(note) }) : summary;
      const join = (...parts: (string | null | false)[]) => parts.filter(Boolean).join(', ');

      switch (entry.type) {
        case 'INCIDENT_CREATED': {
          const onBehalf = person(p, 'onBehalfOf');
          return onBehalf ? t('audit.details.onBehalfOf', { name: onBehalf }) : '';
        }
        case 'TRIAGED': {
          const from = record(p, 'from') ?? {};
          const to = record(p, 'to') ?? {};
          const parts: string[] = [];
          if (from.priority !== to.priority && from.priority) {
            parts.push(t('audit.details.priorityChange', { from: priority(from.priority), to: priority(to.priority) }));
          }
          if (text(from, 'category') !== text(to, 'category')) {
            parts.push(t('audit.details.categoryChange', { from: text(from, 'category') ?? '', to: text(to, 'category') ?? '' }));
          }
          return parts.length > 0
            ? join(...parts)
            : t('audit.details.triageConfirmed', { priority: priority(to.priority), category: text(to, 'category') ?? '' });
        }
        case 'ASSIGNED': {
          const assignee = person(p, 'assignee') ?? '';
          const previous = person(p, 'previous');
          const summary = previous
            ? t('audit.details.reassigned', { previous, name: assignee })
            : t('audit.details.assigned', { name: assignee });
          return withNote(summary, text(p, 'note'));
        }
        case 'UNASSIGNED':
          return withNote(t('audit.details.unassigned', { name: person(p, 'previous') ?? '' }), text(p, 'reason'));
        case 'ASSIGNMENT_DECLINED':
        case 'SENT_BACK':
          return oneLine(text(p, 'reason') ?? '');
        case 'REASSIGNMENT_REQUESTED': {
          const reason = oneOf(reassignmentReasons, p.reasonCode) ? t(`common.reassignmentReason.${p.reasonCode}`) : '';
          return withNote(reason, text(p, 'note'));
        }
        case 'REASSIGNMENT_REJECTED':
          return withNote(t('audit.details.keeps', { name: person(p, 'assignee') ?? '' }), text(p, 'note'));
        case 'PROGRESS_POSTED': {
          const kind = oneOf(progressTypes, p.progressType) ? t(`common.progressType.${p.progressType}`) : '';
          return withNote(kind, text(p, 'note'));
        }
        case 'RESOLVED':
          return oneLine(text(p, 'note') ?? '');
        case 'DISMISSED': {
          const reason = oneOf(dismissReasons, p.reason) ? t(`common.dismissReason.${p.reason}`) : '';
          return withNote(reason, text(p, 'note'));
        }
        case 'COMMENT_ADDED': {
          const visibility = t(p.visibility === 'INTERNAL' ? 'audit.details.commentInternal' : 'audit.details.commentPublic');
          return withNote(visibility, text(p, 'body'));
        }
        case 'ATTACHMENT_ADDED': {
          const kind = oneOf(attachmentKinds, p.kind) ? t(`audit.details.attachmentKind.${p.kind}`) : '';
          const file = text(p, 'fileName') ?? '';
          return kind ? t('audit.details.photo', { file, kind }) : file;
        }
        case 'MEMBER_INVITED': {
          const email = text(p, 'email') ?? '';
          return p.resent === true
            ? t('audit.details.resent', { name, email })
            : t('audit.details.invited', { name, email, role });
        }
        case 'INVITATION_REVOKED':
          return t('audit.details.revoked', { email: text(p, 'email') ?? '', role });
        case 'MEMBER_JOINED':
          return t('audit.details.joined', { name, role });
        case 'MEMBER_UPDATED':
          return p.ownershipTransferred === true ? t('audit.details.ownership', { name }) : name;
        case 'MEMBER_SUSPENDED':
        case 'MEMBER_REACTIVATED':
        case 'MEMBER_REVOKED': {
          const released = typeof p.releasedAssignments === 'number' && p.releasedAssignments > 0 ? p.releasedAssignments : 0;
          return withNote(join(name, released > 0 && tn('audit.details.released', released)), text(p, 'reason'));
        }
        case 'SITE_CREATED': {
          const code = text(p, 'code');
          return code ? t('audit.details.site', { name, code }) : name;
        }
        case 'SITE_UPDATED':
        case 'CATEGORY_UPDATED': {
          const fields = Array.isArray(p.fields) ? p.fields.length : 0;
          return fields > 0 ? t('audit.details.named', { name, rest: tn('audit.details.fields', fields) }) : name;
        }
        case 'CATEGORY_CREATED':
        case 'SPECIALTY_CREATED':
          return name;
        case 'ORG_UPDATED': {
          const fields = Array.isArray(p.fields) ? p.fields.length : 0;
          return fields > 0 ? tn('audit.details.settings', fields) : '';
        }
        case 'ASSIGNMENT_ACCEPTED':
        case 'CLOSED':
          return '';
      }
    },
    [locale, t, tn],
  );
}
