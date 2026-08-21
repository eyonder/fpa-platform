-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "treasuryImportBatchId" TEXT;

-- CreateIndex
CREATE INDEX "BankTransaction_treasuryImportBatchId_idx" ON "BankTransaction"("treasuryImportBatchId");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_treasuryImportBatchId_fkey" FOREIGN KEY ("treasuryImportBatchId") REFERENCES "TreasuryImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
