CREATE TYPE "IncidentChannel" AS ENUM ('APP', 'QR_GUEST');

ALTER TYPE "DismissReason" ADD VALUE 'SPAM';

ALTER TABLE "Incident" ALTER COLUMN "reporterMembershipId" DROP NOT NULL,
ADD COLUMN "channel" "IncidentChannel" NOT NULL DEFAULT 'APP',
ADD COLUMN "guestName" TEXT,
ADD COLUMN "guestPhone" TEXT,
ADD COLUMN "guestConsentAt" TIMESTAMP(3),
ADD COLUMN "trackingTokenHash" TEXT;

CREATE UNIQUE INDEX "Incident_trackingTokenHash_key" ON "Incident"("trackingTokenHash");

-- A report has a reporter, or it came from a visitor through a QR code.
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporter_or_guest"
  CHECK ("reporterMembershipId" IS NOT NULL OR "channel" = 'QR_GUEST');

-- I5 also covers the guest fields.
CREATE OR REPLACE FUNCTION sentinel_protect_incident_original() RETURNS trigger AS $$
BEGIN
  IF NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."reportedCategoryId" IS DISTINCT FROM OLD."reportedCategoryId"
    OR NEW."reportedPriority" IS DISTINCT FROM OLD."reportedPriority"
    OR NEW."reporterMembershipId" IS DISTINCT FROM OLD."reporterMembershipId"
    OR NEW."channel" IS DISTINCT FROM OLD."channel"
    OR NEW."guestName" IS DISTINCT FROM OLD."guestName"
    OR NEW."guestPhone" IS DISTINCT FROM OLD."guestPhone"
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
