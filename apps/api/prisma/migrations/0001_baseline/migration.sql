-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('TRIAL', 'STARTER', 'BUSINESS');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('FACILITIES', 'PROPERTY', 'MANUFACTURING', 'RETAIL', 'HEALTHCARE', 'EDUCATION', 'HOSPITALITY', 'LOGISTICS', 'PUBLIC_SECTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "SizeBand" AS ENUM ('XS', 'S', 'M', 'L', 'XL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserTokenKind" AS ENUM ('PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('SUPERVISOR', 'REPORTER', 'INTERVENANT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'BUSY', 'OFF');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED', 'DECLINED', 'SUPERSEDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProgressType" AS ENUM ('ON_SITE', 'BLOCKED', 'UPDATE');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "DismissReason" AS ENUM ('DUPLICATE', 'NOT_AN_INCIDENT', 'NO_ACTION_NEEDED');

-- CreateEnum
CREATE TYPE "ReassignmentReason" AS ENUM ('CANNOT_ACCESS', 'WRONG_SPECIALTY', 'UNAVAILABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('REPORT', 'EVIDENCE', 'PROGRESS');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('INCIDENT_CREATED', 'TRIAGED', 'ASSIGNED', 'UNASSIGNED', 'ASSIGNMENT_ACCEPTED', 'ASSIGNMENT_DECLINED', 'REASSIGNMENT_REQUESTED', 'REASSIGNMENT_REJECTED', 'PROGRESS_POSTED', 'RESOLVED', 'SENT_BACK', 'CLOSED', 'DISMISSED', 'COMMENT_ADDED', 'ATTACHMENT_ADDED', 'MEMBER_INVITED', 'INVITATION_REVOKED', 'MEMBER_JOINED', 'MEMBER_UPDATED', 'MEMBER_SUSPENDED', 'MEMBER_REACTIVATED', 'MEMBER_REVOKED', 'SITE_CREATED', 'SITE_UPDATED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'SPECIALTY_CREATED', 'ORG_UPDATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INCIDENT_CREATED', 'ASSIGNED', 'ASSIGNED_REPORTER', 'ACCEPTED', 'DECLINED', 'REASSIGNMENT_REQUESTED', 'REASSIGNMENT_REJECTED', 'UNASSIGNED', 'PROGRESS_POSTED', 'RESOLVED', 'SENT_BACK', 'CLOSED', 'COMMENT_ADDED', 'INVITATION_ACCEPTED');

-- CreateEnum
CREATE TYPE "PlatformEventType" AS ENUM ('ORG_SUSPENDED', 'ORG_REACTIVATED', 'PLAN_CHANGED', 'REGISTRATION_RESENT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "mfaVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "UserTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationRegistration" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "organizationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "industry" "Industry" NOT NULL,
    "sizeBand" "SizeBand" NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "timezone" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "website" TEXT,
    "billingEmail" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" "Plan" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "requireResolutionPhoto" BOOLEAN NOT NULL DEFAULT false,
    "showReporterPhone" BOOLEAN NOT NULL DEFAULT false,
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedByMembershipId" UUID,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusChangedAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "membershipId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeCode" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "homeSiteId" UUID,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("membershipId")
);

-- CreateTable
CREATE TABLE "IntervenantProfile" (
    "membershipId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyName" TEXT,
    "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "IntervenantProfile_pkey" PRIMARY KEY ("membershipId")
);

-- CreateTable
CREATE TABLE "Specialty" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntervenantSpecialty" (
    "membershipId" UUID NOT NULL,
    "specialtyId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,

    CONSTRAINT "IntervenantSpecialty_pkey" PRIMARY KEY ("membershipId","specialtyId")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAccess" (
    "membershipId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAccess_pkey" PRIMARY KEY ("membershipId","siteId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "profile" JSONB NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPriority" "Priority" NOT NULL,
    "specialtyId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "siteId" UUID NOT NULL,
    "reporterMembershipId" UUID NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedCategoryId" UUID NOT NULL,
    "reportedPriority" "Priority" NOT NULL,
    "locationDetail" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "categoryId" UUID NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "declinedAt" TIMESTAMP(3),
    "sentBackAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "dismissReason" "DismissReason",
    "dismissNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triagedAt" TIMESTAMP(3),
    "firstAssignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "intervenantMembershipId" UUID NOT NULL,
    "assignedByMembershipId" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "note" TEXT,
    "declineReason" TEXT,
    "reassignmentReason" "ReassignmentReason",
    "reassignmentNote" TEXT,
    "reassignmentRequestedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressUpdate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "authorMembershipId" UUID NOT NULL,
    "type" "ProgressType" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "authorMembershipId" UUID NOT NULL,
    "visibility" "CommentVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "uploadedByMembershipId" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID,
    "actorMembershipId" UUID,
    "actorUserId" UUID,
    "type" "AuditEventType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recipientMembershipId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "incidentId" UUID,
    "actorName" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationCounter" (
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrganizationCounter_pkey" PRIMARY KEY ("organizationId","name")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "userId" UUID NOT NULL,
    "totpSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PlatformAuditEvent" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "organizationId" UUID,
    "type" "PlatformEventType" NOT NULL,
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRegistration_tokenHash_key" ON "OrganizationRegistration"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationRegistration_email_idx" ON "OrganizationRegistration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_id_organizationId_key" ON "Membership"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_membershipId_organizationId_key" ON "EmployeeProfile"("membershipId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_organizationId_employeeCode_key" ON "EmployeeProfile"("organizationId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "IntervenantProfile_membershipId_organizationId_key" ON "IntervenantProfile"("membershipId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_id_organizationId_key" ON "Specialty"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_organizationId_name_key" ON "Specialty"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Site_id_organizationId_key" ON "Site"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_organizationId_code_key" ON "Site"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SiteAccess_siteId_idx" ON "SiteAccess"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_email_idx" ON "Invitation"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentCategory_id_organizationId_key" ON "IncidentCategory"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentCategory_organizationId_name_key" ON "IncidentCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Incident_organizationId_status_priority_idx" ON "Incident"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_organizationId_siteId_idx" ON "Incident"("organizationId", "siteId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_categoryId_idx" ON "Incident"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_reporterMembershipId_idx" ON "Incident"("organizationId", "reporterMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_id_organizationId_key" ON "Incident"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_organizationId_reference_key" ON "Incident"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "Assignment_intervenantMembershipId_status_idx" ON "Assignment"("intervenantMembershipId", "status");

-- CreateIndex
CREATE INDEX "Assignment_incidentId_assignedAt_idx" ON "Assignment"("incidentId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_id_organizationId_key" ON "Assignment"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_incidentId_createdAt_idx" ON "AuditEvent"("organizationId", "incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientMembershipId_readAt_createdAt_idx" ON "Notification"("recipientMembershipId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientMembershipId_dedupeKey_key" ON "Notification"("recipientMembershipId", "dedupeKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_userId_scope_key_key" ON "IdempotencyKey"("userId", "scope", "key");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_organizationId_createdAt_idx" ON "PlatformAuditEvent"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_invitedByMembershipId_organizationId_fkey" FOREIGN KEY ("invitedByMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_homeSiteId_organizationId_fkey" FOREIGN KEY ("homeSiteId", "organizationId") REFERENCES "Site"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IntervenantProfile" ADD CONSTRAINT "IntervenantProfile_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialty" ADD CONSTRAINT "Specialty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervenantSpecialty" ADD CONSTRAINT "IntervenantSpecialty_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervenantSpecialty" ADD CONSTRAINT "IntervenantSpecialty_specialtyId_organizationId_fkey" FOREIGN KEY ("specialtyId", "organizationId") REFERENCES "Specialty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAccess" ADD CONSTRAINT "SiteAccess_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAccess" ADD CONSTRAINT "SiteAccess_siteId_organizationId_fkey" FOREIGN KEY ("siteId", "organizationId") REFERENCES "Site"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByMembershipId_organizationId_fkey" FOREIGN KEY ("invitedByMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IncidentCategory" ADD CONSTRAINT "IncidentCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCategory" ADD CONSTRAINT "IncidentCategory_specialtyId_organizationId_fkey" FOREIGN KEY ("specialtyId", "organizationId") REFERENCES "Specialty"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_siteId_organizationId_fkey" FOREIGN KEY ("siteId", "organizationId") REFERENCES "Site"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterMembershipId_organizationId_fkey" FOREIGN KEY ("reporterMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdByMembershipId_organizationId_fkey" FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_categoryId_organizationId_fkey" FOREIGN KEY ("categoryId", "organizationId") REFERENCES "IncidentCategory"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedCategoryId_organizationId_fkey" FOREIGN KEY ("reportedCategoryId", "organizationId") REFERENCES "IncidentCategory"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId", "organizationId") REFERENCES "Incident"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_intervenantMembershipId_organizationId_fkey" FOREIGN KEY ("intervenantMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedByMembershipId_organizationId_fkey" FOREIGN KEY ("assignedByMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId", "organizationId") REFERENCES "Incident"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_assignmentId_organizationId_fkey" FOREIGN KEY ("assignmentId", "organizationId") REFERENCES "Assignment"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_authorMembershipId_organizationId_fkey" FOREIGN KEY ("authorMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId", "organizationId") REFERENCES "Incident"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorMembershipId_organizationId_fkey" FOREIGN KEY ("authorMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId", "organizationId") REFERENCES "Incident"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedByMembershipId_organizationId_fkey" FOREIGN KEY ("uploadedByMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId", "organizationId") REFERENCES "Incident"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorMembershipId_organizationId_fkey" FOREIGN KEY ("actorMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientMembershipId_organizationId_fkey" FOREIGN KEY ("recipientMembershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId", "organizationId") REFERENCES "Incident"("id", "organizationId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationCounter" ADD CONSTRAINT "OrganizationCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAuditEvent" ADD CONSTRAINT "PlatformAuditEvent_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "PlatformAdmin"("userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAuditEvent" ADD CONSTRAINT "PlatformAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- Invariants Prisma cannot express. Appended to the baseline migration.
-- Review every generated migration for DROP statements against these objects.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- I2: a person holds at most one current employee membership on the platform.
CREATE UNIQUE INDEX "Membership_one_current_reporter_per_user"
  ON "Membership" ("userId")
  WHERE "role" = 'REPORTER' AND "status" IN ('ACTIVE', 'SUSPENDED');

-- I4: at most one live assignment per incident.
CREATE UNIQUE INDEX "Assignment_one_live_per_incident"
  ON "Assignment" ("incidentId")
  WHERE "status" IN ('PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED');

-- Live work per intervenant, used by ranking and workload.
CREATE INDEX "Assignment_live_by_intervenant"
  ON "Assignment" ("intervenantMembershipId")
  WHERE "status" IN ('PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED');

-- At least one owner per organization is enforced in the service layer (I6).
-- An owner must be a supervisor.
ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_owner_is_supervisor" CHECK (NOT "isOwner" OR "role" = 'SUPERVISOR');

-- Length rules mirrored from the shared schemas.
ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_decline_reason_length"
  CHECK ("declineReason" IS NULL OR char_length("declineReason") BETWEEN 5 AND 500);
ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_title_length" CHECK (char_length("title") BETWEEN 3 AND 120),
  ADD CONSTRAINT "Incident_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "Incident_closed_has_timestamp" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);

-- Substring search (ILIKE) on reference, title and description.
CREATE INDEX "Incident_reference_trgm" ON "Incident" USING gin ("reference" gin_trgm_ops);
CREATE INDEX "Incident_title_trgm" ON "Incident" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Incident_description_trgm" ON "Incident" USING gin ("description" gin_trgm_ops);

-- I7: audit rows are append-only. TRUNCATE stays possible for test resets.
CREATE FUNCTION sentinel_reject_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION sentinel_reject_audit_change();

CREATE TRIGGER "PlatformAuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "PlatformAuditEvent"
  FOR EACH ROW EXECUTE FUNCTION sentinel_reject_audit_change();

-- I5: the original report never changes after submission.
CREATE FUNCTION sentinel_protect_incident_original() RETURNS trigger AS $$
BEGIN
  IF NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."reportedCategoryId" IS DISTINCT FROM OLD."reportedCategoryId"
    OR NEW."reportedPriority" IS DISTINCT FROM OLD."reportedPriority"
    OR NEW."reporterMembershipId" IS DISTINCT FROM OLD."reporterMembershipId"
    OR NEW."siteId" IS DISTINCT FROM OLD."siteId"
    OR NEW."locationDetail" IS DISTINCT FROM OLD."locationDetail"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR NEW."reference" IS DISTINCT FROM OLD."reference" THEN
    RAISE EXCEPTION 'Original incident fields are immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  -- I8: a closed incident is read-only.
  IF OLD."status" = 'CLOSED' THEN
    RAISE EXCEPTION 'Closed incidents are read-only' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Incident_protect_original"
  BEFORE UPDATE ON "Incident"
  FOR EACH ROW EXECUTE FUNCTION sentinel_protect_incident_original();
