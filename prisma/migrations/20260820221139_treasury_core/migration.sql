-- CreateEnum
CREATE TYPE "CashFlowDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "CashFlowEventStatus" AS ENUM ('PLANNED', 'NEUTRALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashFlowEventSource" AS ENUM ('MANUAL', 'THP_IMPORT');

-- CreateEnum
CREATE TYPE "MappingLayer" AS ENUM ('CASH', 'ACCRUAL');

-- CreateTable
CREATE TABLE "CashFlowEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "direction" "CashFlowDirection" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "CashFlowEventStatus" NOT NULL DEFAULT 'PLANNED',
    "source" "CashFlowEventSource" NOT NULL DEFAULT 'MANUAL',
    "accrualScenarioId" TEXT,
    "accrualStartMonth" INTEGER,
    "accrualSpreadMonths" INTEGER NOT NULL DEFAULT 1,
    "categoryId" TEXT NOT NULL,
    "counterparty" TEXT,
    "description" TEXT,
    "thpAccountCode" TEXT,
    "mappingConfigId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "direction" "CashFlowDirection" NOT NULL,
    "layer" "MappingLayer" NOT NULL DEFAULT 'CASH',
    "defaultTermDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MappingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "balanceMinor" BIGINT NOT NULL,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "valueDate" DATE NOT NULL,
    "direction" "CashFlowDirection" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT,
    "externalRef" TEXT,
    "matchedEventId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashFlowEvent_tenantId_idx" ON "CashFlowEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CashFlowEvent_scenarioId_dueDate_idx" ON "CashFlowEvent"("scenarioId", "dueDate");

-- CreateIndex
CREATE INDEX "CashFlowEvent_scenarioId_status_idx" ON "CashFlowEvent"("scenarioId", "status");

-- CreateIndex
CREATE INDEX "CashFlowEvent_categoryId_idx" ON "CashFlowEvent"("categoryId");

-- CreateIndex
CREATE INDEX "CashFlowEvent_mappingConfigId_idx" ON "CashFlowEvent"("mappingConfigId");

-- CreateIndex
CREATE INDEX "MappingConfig_tenantId_idx" ON "MappingConfig"("tenantId");

-- CreateIndex
CREATE INDEX "MappingConfig_categoryId_idx" ON "MappingConfig"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MappingConfig_tenantId_accountCode_key" ON "MappingConfig"("tenantId", "accountCode");

-- CreateIndex
CREATE INDEX "BankBalance_tenantId_idx" ON "BankBalance"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankBalance_tenantId_asOfDate_key" ON "BankBalance"("tenantId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_matchedEventId_key" ON "BankTransaction"("matchedEventId");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_idx" ON "BankTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_valueDate_idx" ON "BankTransaction"("tenantId", "valueDate");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_matchedEventId_idx" ON "BankTransaction"("tenantId", "matchedEventId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_tenantId_externalRef_key" ON "BankTransaction"("tenantId", "externalRef");

-- AddForeignKey
ALTER TABLE "CashFlowEvent" ADD CONSTRAINT "CashFlowEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEvent" ADD CONSTRAINT "CashFlowEvent_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEvent" ADD CONSTRAINT "CashFlowEvent_accrualScenarioId_fkey" FOREIGN KEY ("accrualScenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEvent" ADD CONSTRAINT "CashFlowEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEvent" ADD CONSTRAINT "CashFlowEvent_mappingConfigId_fkey" FOREIGN KEY ("mappingConfigId") REFERENCES "MappingConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingConfig" ADD CONSTRAINT "MappingConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingConfig" ADD CONSTRAINT "MappingConfig_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalance" ADD CONSTRAINT "BankBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedEventId_fkey" FOREIGN KEY ("matchedEventId") REFERENCES "CashFlowEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
