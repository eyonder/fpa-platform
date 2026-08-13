-- CreateEnum
CREATE TYPE "FixedAssetCategory" AS ENUM ('BUILDINGS', 'MACHINERY_EQUIPMENT', 'VEHICLES', 'FURNITURE_FIXTURES', 'COMPUTER_HARDWARE', 'LEASEHOLD_IMPROVEMENTS');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'DEPRECIATION';

-- CreateTable
CREATE TABLE "VukAmortismanConfig" (
    "category" "FixedAssetCategory" NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "annualRate" DECIMAL(6,4) NOT NULL,
    "vukReference" TEXT NOT NULL,

    CONSTRAINT "VukAmortismanConfig_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" "FixedAssetCategory" NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "baseValueMinor" BIGINT NOT NULL,
    "usefulLifeYearsOverride" INTEGER,
    "cashFlowProjectionMinor" JSONB NOT NULL,
    "discountRate" DECIMAL(6,4) NOT NULL,
    "description" TEXT,
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedByUserId" TEXT,
    "submittedByUserName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "decidedByUserName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_status_idx" ON "FixedAsset"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_category_idx" ON "FixedAsset"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
