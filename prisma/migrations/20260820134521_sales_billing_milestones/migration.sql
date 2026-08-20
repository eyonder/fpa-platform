-- CreateTable
CREATE TABLE "SalesBillingMilestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salesOpportunityId" TEXT NOT NULL,
    "billingDate" DATE NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "SalesBillingMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesBillingMilestone_tenantId_idx" ON "SalesBillingMilestone"("tenantId");

-- CreateIndex
CREATE INDEX "SalesBillingMilestone_salesOpportunityId_idx" ON "SalesBillingMilestone"("salesOpportunityId");

-- AddForeignKey
ALTER TABLE "SalesBillingMilestone" ADD CONSTRAINT "SalesBillingMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillingMilestone" ADD CONSTRAINT "SalesBillingMilestone_salesOpportunityId_fkey" FOREIGN KEY ("salesOpportunityId") REFERENCES "SalesOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
