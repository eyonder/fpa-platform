import { prisma } from "@/backend/core/prisma-client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `FxRate` küresel referans verisidir (RLS'e tabi DEĞİL — bkz.
 * `prisma/schema.prisma`) — gerçek bir TCMB/ECB/serbest piyasa besleme
 * günlük bir job ile bu tabloyu doldurur; servis katmanı değişmez.
 */

export interface FxRateRecord {
  /** YYYY-MM-DD, bu kurun yürürlüğe girdiği gün. */
  date: string;
  base: string;
  quote: string;
  /** 1 base = rate quote. */
  rate: number;
}

export const fxRateRepository = {
  /** base/quote çifti için, asOfDate'te ya da ONDAN ÖNCEKİ en güncel kur. */
  async findLatestOnOrBefore(
    base: string,
    quote: string,
    asOfDate: string,
  ): Promise<FxRateRecord | null> {
    const row = await prisma.fxRate.findFirst({
      where: { base, quote, date: { lte: new Date(asOfDate) } },
      orderBy: { date: "desc" },
    });

    if (!row) return null;

    return {
      date: row.date.toISOString().slice(0, 10),
      base: row.base,
      quote: row.quote,
      rate: row.rate,
    };
  },
};
