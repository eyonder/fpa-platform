import { prismaAsTxClient, withTenantTransaction } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { SalesBillingMilestone } from "@/shared/types";
import type { SalesBillingMilestone as SalesBillingMilestoneRow } from "@prisma/client";

import type { SetBillingMilestonesInput } from "./sales.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `SalesBillingMilestone` RLS'e TABİDİR. DB'de tutar `amountMinor` (kuruş,
 * `BigInt`) olarak saklanır — `shared/lib/money.ts`teki
 * `toMinorUnits`/`fromMinorUnits` ile bu sınırda çevrilir (bkz.
 * sales-opportunity.repository.ts ile aynı disiplin).
 */

function toSalesBillingMilestone(row: SalesBillingMilestoneRow): SalesBillingMilestone {
  return {
    billingDate: row.billingDate.toISOString().slice(0, 10),
    amount: fromMinorUnits(Number(row.amountMinor)),
  };
}

export const salesBillingMilestoneRepository = {
  async findByOpportunity(
    tenantId: string,
    salesOpportunityId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<SalesBillingMilestone[]> {
    const rows = await client.salesBillingMilestone.findMany({
      where: { tenantId, salesOpportunityId },
      orderBy: { billingDate: "asc" },
    });
    return rows.map(toSalesBillingMilestone);
  },

  /**
   * Milestone listesini TAMAMEN değiştirir — `allocationKeyRepository.upsert`teki
   * AYNI sil-sonra-topluca-oluştur deseni. Çok adımlı bir tenant yazma akışı
   * olduğu için `withTenantTransaction` ZORUNLU (`prisma`nın otomatik
   * `$allOperations` sarmalaması açık bir transaction'a İÇ İÇE GİREMEZ, bkz.
   * prisma-client.ts).
   */
  async replaceAll(
    tenantId: string,
    salesOpportunityId: string,
    input: SetBillingMilestonesInput,
  ): Promise<SalesBillingMilestone[]> {
    return withTenantTransaction(tenantId, async (tx) => {
      await tx.salesBillingMilestone.deleteMany({
        where: { tenantId, salesOpportunityId },
      });

      if (input.milestones.length > 0) {
        await tx.salesBillingMilestone.createMany({
          data: input.milestones.map((m) => ({
            id: crypto.randomUUID(),
            tenantId,
            salesOpportunityId,
            billingDate: new Date(m.billingDate),
            amountMinor: BigInt(toMinorUnits(m.amount)),
          })),
        });
      }

      const rows = await tx.salesBillingMilestone.findMany({
        where: { tenantId, salesOpportunityId },
        orderBy: { billingDate: "asc" },
      });
      return rows.map(toSalesBillingMilestone);
    });
  },
};
