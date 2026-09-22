export enum UserRole {
  USER = 'USER',
  RESPONSABLE = 'RESPONSABLE',
  ADMINISTRATOR = 'ADMINISTRATOR'
}

export enum IncidentStatus {
  NEW = 'NEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles?: UserRole[];
}

export interface Incident {
  id: string;
  organizationId: string;
  siteId: string;
  reporterId: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  organizationId: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}
