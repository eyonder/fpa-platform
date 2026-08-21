import { prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { BudgetCategory, BudgetLine, BudgetLineInput } from "@/shared/types";
import type {
  BudgetCategory as BudgetCategoryRow,
  BudgetLine as BudgetLineRow,
} from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `BudgetLine` RLS'e TABİDİR; `BudgetCategory` küresel referans verisidir
 * (RLS YOK, bugünkü davranışla aynı — bkz. `prisma/schema.prisma`).
 *
 * DB'de tutar `amountMinor` (kuruş, `BigInt`) olarak saklanır — bu sınırda
 * (boundary) `shared/lib/money.ts`teki `toMinorUnits`/`fromMinorUnits` ile
 * domain tipinin (`BudgetLine.amount`, majör birim `number`) karşılığına
 * çevrilir. `bulkUpsert`, `budgetLineService.bulkUpsert`in açtığı TEK bir
 * transaction içinde çağrılır (bkz. `backend/core/prisma-client.ts`teki
 * `withTenantTransaction` ve o servisteki yorum) — bu yüzden ikinci
 * (opsiyonel) `client` parametresini alır.
 */

function toBudgetCategory(row: BudgetCategoryRow): BudgetCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    sortOrder: row.sortOrder,
  };
}

function toBudgetLine(row: BudgetLineRow): BudgetLine {
  return {
    scenarioId: row.scenarioId,
    categoryId: row.categoryId,
    month: row.month,
    amount: fromMinorUnits(Number(row.amountMinor)),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const budgetLineRepository = {
  /** `tenantId` ZORUNLU: BudgetCategory artık tenant'a özeldir (RLS'li).
   * Eskiden parametresizdi ve küresel listeyi dönerdi. */
  async findCategories(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BudgetCategory[]> {
    const rows = await client.budgetCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(toBudgetCategory);
  },

  /** Modüllerin sabit kategori referansı (`cat-personel` gibi) artık id
   * DEĞİL KOD taşır; id tenant'a göre burada çözümlenir. */
  async findCategoryByCode(
    tenantId: string,
    code: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BudgetCategory | null> {
    const row = await client.budgetCategory.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    return row ? toBudgetCategory(row) : null;
  },

  async findByScenario(
    scenarioId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BudgetLine[]> {
    const rows = await client.budgetLine.findMany({ where: { scenarioId } });
    return rows.map(toBudgetLine);
  },

  async bulkUpsert(
    scenarioId: string,
    tenantId: string,
    inputs: BudgetLineInput[],
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BudgetLine[]> {
    const updated: BudgetLine[] = [];

    // Sıralı (paralel değil): aynı transaction/bağlantı üzerinde çalışır,
    // sıra korunur ve `bulkUpsertBudgetLinesSchema`'nın zaten 1-500 satırla
    // sınırladığı hacim için performans sorunu yaratmaz.
    for (const input of inputs) {
      const row = await client.budgetLine.upsert({
        where: {
          scenarioId_categoryId_month: {
            scenarioId,
            categoryId: input.categoryId,
            month: input.month,
          },
        },
        create: {
          scenarioId,
          categoryId: input.categoryId,
          month: input.month,
          tenantId,
          amountMinor: BigInt(toMinorUnits(input.amount)),
        },
        update: {
          amountMinor: BigInt(toMinorUnits(input.amount)),
        },
      });
      updated.push(toBudgetLine(row));
    }

    return updated;
  },
};
