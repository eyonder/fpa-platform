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
   * Hazine projeksiyonu (Faz 4.4) için: KAZANILMIŞ (WON) fırsatların verilen
   * gün aralığındaki hakediş faturalama tarihleri, fırsat bilgisiyle birlikte.
   *
   * `sales-forecast.service.ts#previewActuals`in TAM TERSİ: orası bu günleri
   * BudgetLine'a yazmak için AYA toplar, burada gün hassasiyeti KORUNUR —
   * 90 günlük bir nakit tablosunda ayın 3'ü ile 28'i aynı şey değildir.
   */
  async findWonInWindow(
    tenantId: string,
    fromDate: string,
    toDate: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<DerivedSalesMilestone[]> {
    const rows = await client.salesBillingMilestone.findMany({
      where: {
        tenantId,
        billingDate: { gte: new Date(fromDate), lte: new Date(toDate) },
        salesOpportunity: { stage: "WON" },
      },
      include: { salesOpportunity: true },
      orderBy: { billingDate: "asc" },
    });
    return rows.map((row) => ({
      milestoneId: row.id,
      opportunityId: row.salesOpportunityId,
      billingDate: row.billingDate.toISOString().slice(0, 10),
      amount: fromMinorUnits(Number(row.amountMinor)),
      customerName: row.salesOpportunity.customerName,
      dealName: row.salesOpportunity.dealName,
    }));
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

/** Hazine projeksiyonunun ihtiyaç duyduğu, fırsat bilgisiyle zenginleştirilmiş
 * hakediş satırı (paylaşılan `SalesBillingMilestone` tipi id taşımaz — orada
 * gerekmiyordu, burada satır kimliği ŞART). */
export interface DerivedSalesMilestone {
  milestoneId: string;
  opportunityId: string;
  /** YYYY-MM-DD */
  billingDate: string;
  amount: number;
  customerName: string;
  dealName: string;
}
