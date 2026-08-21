import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { BankBalanceSnapshot } from "@/shared/types";
import type { BankBalance as BankBalanceRow } from "@prisma/client";

import { toIsoDate } from "./treasury.dates";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `BankBalance` RLS'e TABİDİR. `@@unique([tenantId, asOfDate])` sayesinde
 * günde TEK fotoğraf vardır — aynı gün tekrar girilirse UPSERT edilir
 * (yeni satır DEĞİL): iki farklı "31 Ağustos bakiyesi" olsaydı projeksiyonun
 * çıpası belirsizleşirdi.
 */

function toSnapshot(row: BankBalanceRow): BankBalanceSnapshot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    asOfDate: toIsoDate(row.asOfDate),
    balance: fromMinorUnits(Number(row.balanceMinor)),
    note: row.note,
    recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const bankBalanceRepository = {
  async findLatest(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankBalanceSnapshot | null> {
    const row = await client.bankBalance.findFirst({
      where: { tenantId },
      orderBy: { asOfDate: "desc" },
    });
    return row ? toSnapshot(row) : null;
  },

  /** Projeksiyonun ÇIPASI: `asOfDate <= onOrBefore` olan EN GÜNCEL fotoğraf.
   * İleri tarihli bir fotoğrafın geçmiş bir pencereye çıpa olması yanlış
   * olurdu, bu yüzden tarih sınırı burada uygulanır. */
  async findAnchor(
    tenantId: string,
    onOrBefore: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankBalanceSnapshot | null> {
    const row = await client.bankBalance.findFirst({
      where: { tenantId, asOfDate: { lte: new Date(onOrBefore) } },
      orderBy: { asOfDate: "desc" },
    });
    return row ? toSnapshot(row) : null;
  },

  async listRecent(
    tenantId: string,
    limit = 20,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankBalanceSnapshot[]> {
    const rows = await client.bankBalance.findMany({
      where: { tenantId },
      orderBy: { asOfDate: "desc" },
      take: limit,
    });
    return rows.map(toSnapshot);
  },

  async upsert(
    tenantId: string,
    userId: string,
    input: { asOfDate: string; balance: number; note?: string },
  ): Promise<BankBalanceSnapshot> {
    const row = await prisma.bankBalance.upsert({
      where: { tenantId_asOfDate: { tenantId, asOfDate: new Date(input.asOfDate) } },
      create: {
        id: crypto.randomUUID(),
        tenantId,
        asOfDate: new Date(input.asOfDate),
        balanceMinor: BigInt(toMinorUnits(input.balance)),
        note: input.note ?? null,
        recordedByUserId: userId,
      },
      update: {
        balanceMinor: BigInt(toMinorUnits(input.balance)),
        note: input.note ?? null,
        recordedByUserId: userId,
      },
    });
    return toSnapshot(row);
  },
};
