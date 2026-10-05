// === ENUMS / LITERALS ===
export type IncidentStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type UserRole = 'ADMINISTRATOR' | 'RESPONSABLE' | 'USER';
export type Category = string;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  organizationId: string;
  organizationName: string;
  roles: UserRole[];
}

// === CORE ENTITIES ===
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  specialties?: string[];
  assignedSites?: string[]; // site ids
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  radiusMeters?: number;
  boundaryType?: 'CIRCLE' | 'POLYGON';
  _count?: { incidents: number };
}

export interface Incident {
  id: string;
  incNumber?: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  category: string;
  siteId?: string;
  site: Site;
  exactLocation?: string;
  latitude: number;
  longitude: number;
  reporterId?: string;
  reporter?: User;
  reportedBy?: string;
  reportedAt?: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  activity: ActivityEvent[];
  attachments: Attachment[];
  resolution?: string;
  version?: number;
  assignments?: any[];
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type: 'reported' | 'notified' | 'assigned' | 'progress' | 'resolved' | 'reviewed' | 'comment' | 'closed' | 'rejected';
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface Notification {
  id: string;
  type: 'assignment' | 'status_change' | 'comment' | 'resolution' | 'closure';
  title: string;
  message: string;
  incidentId?: string;
  read: boolean;
  createdAt: string;
}

// === DASHBOARD ===
export interface DashboardStats {
  activeIncidents: number;
  activeSites: number;
  criticalCount: number;
  unassignedCount: number;
  awaitingReview: number;
  oldestReviewHours: number;
  closedThisMonth: number;
  closedPercentChange: number;
}

// === MAP ===
export interface MapMarker {
  id: string;
  type: 'incident' | 'site';
  latitude: number;
  longitude: number;
  label: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
}
