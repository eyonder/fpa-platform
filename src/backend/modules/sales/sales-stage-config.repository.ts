import { prisma } from "@/backend/core/prisma-client";
import type { SalesStageConfigEntry } from "@/shared/types";
import type { SalesStageConfig as SalesStageConfigRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `SalesStageConfig` KÜRESEL referans veridir (`VukAmortismanConfig` gibi) —
 * RLS YOK, aşama bazlı varsayılan kazanma olasılıkları iş politikasıdır
 * (VUK/SGK gibi yasal zorunluluk DEĞİL), her tenant için aynı başlar.
 * Değerler `prisma/seed.ts` içinde doldurulur — kod içine GÖMÜLMEZ.
 */

function toEntry(row: SalesStageConfigRow): SalesStageConfigEntry {
  return {
    stage: row.stage,
    defaultWinProbability: Number(row.defaultWinProbability),
  };
}

export const salesStageConfigRepository = {
  async findAll(): Promise<SalesStageConfigEntry[]> {
    const rows = await prisma.salesStageConfig.findMany();
    return rows.map(toEntry);
  },

  async findByStage(
    stage: SalesStageConfigEntry["stage"],
  ): Promise<SalesStageConfigEntry | null> {
    const row = await prisma.salesStageConfig.findUnique({ where: { stage } });
    return row ? toEntry(row) : null;
  },
};
