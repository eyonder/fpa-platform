-- CreateEnum
CREATE TYPE "ExpenseEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMMITTED');

-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'EXPENSE';

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCostCenterId" TEXT,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceCostCenterId" TEXT NOT NULL,

    CONSTRAINT "AllocationKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationKeyMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "allocationKeyId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "AllocationKeyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "ExpenseEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedByUserId" TEXT,
    "submittedByUserName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "decidedByUserName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostCenter_tenantId_parentCostCenterId_idx" ON "CostCenter"("tenantId", "parentCostCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_tenantId_code_key" ON "CostCenter"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationKey_sourceCostCenterId_key" ON "AllocationKey"("sourceCostCenterId");

-- CreateIndex
CREATE INDEX "AllocationKeyMember_tenantId_idx" ON "AllocationKeyMember"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationKeyMember_allocationKeyId_costCenterId_key" ON "AllocationKeyMember"("allocationKeyId", "costCenterId");

-- CreateIndex
CREATE INDEX "ExpenseEntry_tenantId_scenarioId_status_idx" ON "ExpenseEntry"("tenantId", "scenarioId", "status");

-- CreateIndex
CREATE INDEX "ExpenseEntry_tenantId_costCenterId_idx" ON "ExpenseEntry"("tenantId", "costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEntry_tenantId_scenarioId_costCenterId_categoryId_mo_key" ON "ExpenseEntry"("tenantId", "scenarioId", "costCenterId", "categoryId", "month");

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_parentCostCenterId_fkey" FOREIGN KEY ("parentCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKey" ADD CONSTRAINT "AllocationKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKey" ADD CONSTRAINT "AllocationKey_sourceCostCenterId_fkey" FOREIGN KEY ("sourceCostCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKeyMember" ADD CONSTRAINT "AllocationKeyMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKeyMember" ADD CONSTRAINT "AllocationKeyMember_allocationKeyId_fkey" FOREIGN KEY ("allocationKeyId") REFERENCES "AllocationKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKeyMember" ADD CONSTRAINT "AllocationKeyMember_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
