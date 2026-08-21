-- CreateEnum
CREATE TYPE "TreasuryImportStatus" AS ENUM ('PENDING_REVIEW', 'COMMITTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "TreasuryImportKind" AS ENUM ('THP', 'BANK_STATEMENT');

-- AlterTable
ALTER TABLE "CashFlowEvent" ADD COLUMN     "treasuryImportBatchId" TEXT;

-- CreateTable
CREATE TABLE "TreasuryImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "TreasuryImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "kind" "TreasuryImportKind" NOT NULL DEFAULT 'THP',
    "rawGrid" JSONB,
    "appliedMapping" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "mappedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryImportBatch_tenantId_idx" ON "TreasuryImportBatch"("tenantId");

-- CreateIndex
CREATE INDEX "TreasuryImportBatch_scenarioId_idx" ON "TreasuryImportBatch"("scenarioId");

-- CreateIndex
CREATE INDEX "CashFlowEvent_treasuryImportBatchId_idx" ON "CashFlowEvent"("treasuryImportBatchId");

-- AddForeignKey
ALTER TABLE "CashFlowEvent" ADD CONSTRAINT "CashFlowEvent_treasuryImportBatchId_fkey" FOREIGN KEY ("treasuryImportBatchId") REFERENCES "TreasuryImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryImportBatch" ADD CONSTRAINT "TreasuryImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryImportBatch" ADD CONSTRAINT "TreasuryImportBatch_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
