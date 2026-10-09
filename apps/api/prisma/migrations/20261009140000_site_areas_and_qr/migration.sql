-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "areaId" UUID;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "guestReporting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicToken" TEXT;

-- CreateTable
CREATE TABLE "SiteArea" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteArea_publicToken_key" ON "SiteArea"("publicToken");

-- CreateIndex
CREATE INDEX "SiteArea_siteId_idx" ON "SiteArea"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteArea_id_organizationId_key" ON "SiteArea"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_publicToken_key" ON "Site"("publicToken");

-- AddForeignKey
ALTER TABLE "SiteArea" ADD CONSTRAINT "SiteArea_siteId_organizationId_fkey" FOREIGN KEY ("siteId", "organizationId") REFERENCES "Site"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "SiteArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

