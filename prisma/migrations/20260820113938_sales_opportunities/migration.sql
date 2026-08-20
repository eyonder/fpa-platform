-- CreateEnum
CREATE TYPE "SalesOpportunityStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'SALES';

-- CreateTable
CREATE TABLE "SalesStageConfig" (
    "stage" "SalesOpportunityStage" NOT NULL,
    "defaultWinProbability" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "SalesStageConfig_pkey" PRIMARY KEY ("stage")
);

-- CreateTable
CREATE TABLE "SalesOpportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "dealName" TEXT NOT NULL,
    "expectedValueMinor" BIGINT NOT NULL,
    "expectedCloseDate" DATE NOT NULL,
    "stage" "SalesOpportunityStage" NOT NULL DEFAULT 'LEAD',
    "winProbabilityOverride" DECIMAL(6,4),
    "closedAt" DATE,
    "closedByUserId" TEXT,
    "closedByUserName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesOpportunity_tenantId_stage_idx" ON "SalesOpportunity"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "SalesOpportunity_tenantId_expectedCloseDate_idx" ON "SalesOpportunity"("tenantId", "expectedCloseDate");

-- CreateIndex
CREATE INDEX "SalesOpportunity_tenantId_closedAt_idx" ON "SalesOpportunity"("tenantId", "closedAt");

-- AddForeignKey
ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
