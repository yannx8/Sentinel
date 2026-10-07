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
