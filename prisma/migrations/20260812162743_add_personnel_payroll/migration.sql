-- CreateEnum
CREATE TYPE "DisabilityDegree" AS ENUM ('NONE', 'DEGREE_1', 'DEGREE_2', 'DEGREE_3');

-- CreateEnum
CREATE TYPE "CompensationInputMode" AS ENUM ('GROSS_FIXED', 'NET_FIXED');

-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'PAYROLL';

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRetired" BOOLEAN NOT NULL DEFAULT false,
    "isConcierge" BOOLEAN NOT NULL DEFAULT false,
    "disabilityDegree" "DisabilityDegree" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompensation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "inputMode" "CompensationInputMode" NOT NULL,
    "compensationCiphertext" TEXT NOT NULL,

    CONSTRAINT "EmployeeCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollTaxConfig" (
    "fiscalYear" INTEGER NOT NULL,
    "minimumWageGrossMonthlyMinor" BIGINT NOT NULL,
    "sgkCeilingMinor" BIGINT NOT NULL,
    "severanceCeilingH1Minor" BIGINT NOT NULL,
    "severanceCeilingH2Minor" BIGINT NOT NULL,
    "dailyMealAllowanceExemptMinor" BIGINT NOT NULL,
    "dailyTransportAllowanceExemptMinor" BIGINT NOT NULL,
    "employeeSgkRate" DECIMAL(6,4) NOT NULL,
    "employeeUnemploymentRate" DECIMAL(6,4) NOT NULL,
    "employerSgkRate" DECIMAL(6,4) NOT NULL,
    "employerSgkIncentiveRate" DECIMAL(6,4) NOT NULL,
    "employerUnemploymentRate" DECIMAL(6,4) NOT NULL,
    "retiredEmployeeSgdpRate" DECIMAL(6,4) NOT NULL,
    "retiredEmployerSgdpRate" DECIMAL(6,4) NOT NULL,
    "incomeTaxBrackets" JSONB NOT NULL,
    "stampDutyRate" DECIMAL(6,5) NOT NULL,
    "minimumWageIncomeTaxExemptionMonthlyMinor" BIGINT NOT NULL,
    "minimumWageStampTaxExemptionMonthlyMinor" BIGINT NOT NULL,
    "disabilityDeductionDegree1Minor" BIGINT NOT NULL,
    "disabilityDeductionDegree2Minor" BIGINT NOT NULL,
    "disabilityDeductionDegree3Minor" BIGINT NOT NULL,
    "standardMonthlyWorkingHours" INTEGER NOT NULL DEFAULT 225,
    "overtimePremiumMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,

    CONSTRAINT "PayrollTaxConfig_pkey" PRIMARY KEY ("fiscalYear")
);

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeCompensation_employeeId_effectiveFrom_idx" ON "EmployeeCompensation"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeCompensation_tenantId_idx" ON "EmployeeCompensation"("tenantId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
