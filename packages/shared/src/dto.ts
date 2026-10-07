/**
 * Response shapes. Dates travel as ISO 8601 strings.
 * Success bodies are `{ data }` or `{ data, page }` for cursor lists.
 */
import type { IncidentAction } from './domain';
import type {
  AttachmentKind,
  AuditEventType,
  Availability,
  DismissReason,
  IncidentStatus,
  Industry,
  LiveAssignmentStatus,
  Locale,
  MembershipRole,
  MembershipStatus,
  NotificationType,
  OrganizationStatus,
  Plan,
  PlatformEventType,
  Priority,
  ReassignmentReason,
  SizeBand,
} from './enums';
import type { CandidateWarning, IneligibleReason } from './ranking';
import type { PersonRef } from './thread';

export type { PersonRef };

export type Page<T> = { data: T[]; page: { nextCursor: string | null; hasMore: boolean } };

/* Identity */

export type OrganizationRef = { id: string; displayName: string };

export type MembershipSummary = {
  id: string;
  role: MembershipRole;
  isOwner: boolean;
  organization: OrganizationRef & {
    status: OrganizationStatus;
    timezone: string;
    defaultLocale: Locale;
    /** Shown on the suspension screen. */
    ownerName: string | null;
    ownerEmail: string | null;
  };
};

export type Me = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    locale: Locale;
  };
  memberships: MembershipSummary[];
  platformAdmin: { mfaVerified: boolean } | null;
};

export type SessionDTO = {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
};

/* Incidents */

export type IncidentListItem = {
  id: string;
  reference: string;
  title: string;
  status: IncidentStatus;
  /** Triaged priority, or the reported suggestion until triage. */
  priority: Priority;
  triaged: boolean;
  site: { id: string; code: string; name: string };
  category: { id: string; name: string };
  reporter: PersonRef;
  assignee: (PersonRef & { assignmentId: string; status: LiveAssignmentStatus }) | null;
  /** Reasons a supervisor should look now. */
  flags: { declined: boolean; reassignmentRequested: boolean; sentBack: boolean };
  organization: OrganizationRef;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type SavedViewDTO = {
  id: string;
  name: string;
  params: Record<string, string>;
  createdAt: string;
};

export type BulkIncidentsResult = {
  done: string[];
  failed: { reference: string; code: string; message: string }[];
};

export type AttachmentDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  uploadedBy: PersonRef;
  createdAt: string;
  /** Same-origin path, served after a scope check. */
  url: string;
};

export type LiveAssignmentDTO = {
  id: string;
  status: LiveAssignmentStatus;
  intervenant: PersonRef & { companyName: string | null; phone: string | null };
  assignedBy: PersonRef;
  assignedAt: string;
  respondedAt: string | null;
  note: string | null;
  reassignment: { reasonCode: ReassignmentReason; note: string | null; requestedAt: string } | null;
};

export type IncidentDetail = IncidentListItem & {
  description: string;
  locationDetail: string | null;
  latitude: number | null;
  longitude: number | null;
  reportedPriority: Priority;
  reportedCategory: { id: string; name: string };
  reporterPhone: string | null;
  triagedAt: string | null;
  firstAssignedAt: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNote: string | null;
  dismissReason: DismissReason | null;
  dismissNote: string | null;
  liveAssignment: LiveAssignmentDTO | null;
  attachments: AttachmentDTO[];
  /** What the viewer may do now, computed with the shared rules. */
  actions: IncidentAction[];
  requireResolutionPhoto: boolean;
};

export type CandidateDTO = {
  membershipId: string;
  name: string;
  companyName: string | null;
  specialties: string[];
  availability: Availability;
  openAssignments: number;
  specialtyMatch: boolean;
  siteAccess: boolean;
  eligible: boolean;
  reason: IneligibleReason | null;
  warning: CandidateWarning | null;
};

export type ReassignmentRequestDTO = {
  assignmentId: string;
  incident: { id: string; reference: string; title: string; priority: Priority; site: string; version: number };
  intervenant: PersonRef;
  reasonCode: ReassignmentReason;
  note: string | null;
  requestedAt: string;
};

/* Organization setup */

export type OrganizationSettings = {
  id: string;
  legalName: string;
  displayName: string;
  registrationNumber: string | null;
  industry: Industry;
  sizeBand: SizeBand;
  country: string;
  city: string | null;
  timezone: string;
  defaultLocale: Locale;
  website: string | null;
  billingEmail: string;
  requireResolutionPhoto: boolean;
  showReporterPhone: boolean;
  plan: Plan;
  trialEndsAt: string | null;
  status: OrganizationStatus;
  createdAt: string;
};

export type SetupChecklist = {
  hasSite: boolean;
  hasCategory: boolean;
  hasIntervenant: boolean;
  hasEmployee: boolean;
  hasIncident: boolean;
};

export type SiteDTO = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  openIncidents: number;
  intervenants: number;
  createdAt: string;
};

export type SpecialtyDTO = { id: string; name: string; intervenants: number; categories: number };

export type CategoryDTO = {
  id: string;
  name: string;
  defaultPriority: Priority;
  specialty: { id: string; name: string } | null;
  isActive: boolean;
  openIncidents: number;
};

/* People */

export type MemberDTO = {
  id: string;
  role: MembershipRole;
  isOwner: boolean;
  status: MembershipStatus;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  employee: {
    employeeCode: string | null;
    jobTitle: string | null;
    department: string | null;
    homeSite: { id: string; name: string } | null;
  } | null;
  intervenant: {
    companyName: string | null;
    availability: Availability;
    specialties: { id: string; name: string }[];
    sites: { id: string; name: string }[];
    liveAssignments: number;
  } | null;
};

export type InvitationStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

export type InvitationDTO = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: MembershipRole;
  status: InvitationStatus;
  invitedBy: PersonRef | null;
  createdAt: string;
  expiresAt: string;
};

export type InviteResult = {
  invitation: InvitationDTO;
  /** Shareable link. The token is only ever shown here, at creation or resend. */
  acceptUrl: string;
  emailSent: boolean;
};

export type InvitationPreview = {
  organization: string;
  role: MembershipRole;
  email: string;
  firstName: string;
  lastName: string;
  /** True when an account already exists: the person signs in instead of choosing a password. */
  existingAccount: boolean;
};

export type ImportRowResult = {
  line: number;
  email: string;
  status: 'READY' | 'CREATED' | 'SKIPPED' | 'ERROR';
  errors: string[];
};

export type ImportResult = {
  dryRun: boolean;
  total: number;
  ready: number;
  created: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
};

/* Notifications */

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  organization: OrganizationRef;
  incident: { id: string; reference: string; title: string } | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
};

/* Reporting */

export type AgeingBucket = 'UNDER_4H' | 'H4_TO_24H' | 'D1_TO_3D' | 'OVER_3D';

export type DashboardDTO = {
  counts: {
    open: number;
    unassigned: number;
    pendingAcceptance: number;
    inProgress: number;
    awaitingReview: number;
    reassignmentRequests: number;
    criticalOpen: number;
  };
  /** Medians over incidents created in the last 30 days, in minutes. */
  medians: { toAssign: number | null; toAcknowledge: number | null; toResolve: number | null };
  ageing: { bucket: AgeingBucket; count: number }[];
  oldestOpen: { id: string; reference: string; title: string; status: IncidentStatus; createdAt: string }[];
  byPriority: { priority: Priority; count: number }[];
  bySite: { id: string; name: string; open: number; critical: number }[];
  byCategory: { id: string; name: string; open: number }[];
  workload: {
    membershipId: string;
    name: string;
    availability: Availability;
    live: number;
    pending: number;
    oldestLiveAt: string | null;
  }[];
  trend: { date: string; created: number; resolved: number }[];
};

export type AuditEntryDTO = {
  id: string;
  type: AuditEventType;
  actor: PersonRef | null;
  incident: { id: string; reference: string } | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

/* Platform */

export type PlatformOrganizationDTO = {
  id: string;
  displayName: string;
  legalName: string;
  status: OrganizationStatus;
  plan: Plan;
  trialEndsAt: string | null;
  industry: Industry;
  country: string;
  createdAt: string;
  owner: { name: string; email: string } | null;
  counts: { members: number; sites: number; incidentsLast30Days: number };
  lastActivityAt: string | null;
};

export type PlatformAuditDTO = {
  id: string;
  type: PlatformEventType;
  admin: { name: string; email: string };
  organization: OrganizationRef | null;
  reason: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type PlatformOrganizationDetail = PlatformOrganizationDTO & {
  registrationNumber: string | null;
  billingEmail: string;
  timezone: string;
  counts: PlatformOrganizationDTO['counts'] & {
    supervisors: number;
    employees: number;
    intervenants: number;
    openIncidents: number;
  };
  history: PlatformAuditDTO[];
};

export type RegistrationDTO = {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  status: 'PENDING' | 'EXPIRED' | 'VERIFIED';
  createdAt: string;
  expiresAt: string;
};
