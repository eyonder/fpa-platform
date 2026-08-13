import { prisma } from "@/backend/core/prisma-client";
import type { VukAmortismanConfigEntry } from "@/shared/types";
import type { VukAmortismanConfig as VukAmortismanConfigRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `VukAmortismanConfig` KÜRESEL referans veridir (`PayrollTaxConfig` gibi) —
 * RLS YOK, VUK amortisman oranları her tenant için aynı yasal mevzuattır.
 * Değerler `prisma/seed.ts` içinde, kullanıcının verdiği GERÇEK oranlarla
 * doldurulur — kod içine GÖMÜLMEZ (bkz. schema.prisma'daki model yorumu).
 */

function toEntry(row: VukAmortismanConfigRow): VukAmortismanConfigEntry {
  return {
    category: row.category,
    usefulLifeYears: row.usefulLifeYears,
    annualRate: Number(row.annualRate),
    vukReference: row.vukReference,
  };
}

export const vukAmortismanConfigRepository = {
  async findAll(): Promise<VukAmortismanConfigEntry[]> {
    const rows = await prisma.vukAmortismanConfig.findMany();
    return rows.map(toEntry);
  },

  async findByCategory(
    category: VukAmortismanConfigEntry["category"],
  ): Promise<VukAmortismanConfigEntry | null> {
    const row = await prisma.vukAmortismanConfig.findUnique({ where: { category } });
    return row ? toEntry(row) : null;
  },
};
