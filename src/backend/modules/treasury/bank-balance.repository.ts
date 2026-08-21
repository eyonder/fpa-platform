import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { BankBalanceSnapshot } from "@/shared/types";
import type {
  BankAccount as BankAccountRow,
  BankBalance as BankBalanceRow,
} from "@prisma/client";

import { toIsoDate } from "./treasury.dates";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `BankBalance` RLS'e TABİDİR. `@@unique([tenantId, bankAccountId, asOfDate])`
 * sayesinde HESAP BAŞINA günde TEK fotoğraf vardır — aynı gün tekrar girilirse
 * UPSERT edilir (yeni satır DEĞİL): aynı hesap için iki farklı "18 Ağustos
 * bakiyesi" olsaydı projeksiyonun çıpası belirsizleşirdi.
 *
 * Tutar HESABIN KENDİ para birimindedir; raporlama birimine çevrim burada
 * DEĞİL, projeksiyon anında FxRate ile yapılır (bkz. bank.service.ts) — kur
 * değiştiğinde geçmişe dönük veri düzeltmesi gerekmesin diye.
 */

type BalanceWithAccount = BankBalanceRow & { bankAccount: BankAccountRow };

function toSnapshot(row: BalanceWithAccount): BankBalanceSnapshot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    bankAccountId: row.bankAccountId,
    bankName: row.bankAccount.bankName,
    currency: row.bankAccount.currency,
    asOfDate: toIsoDate(row.asOfDate),
    balance: fromMinorUnits(Number(row.balanceMinor)),
    note: row.note,
    recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const bankBalanceRepository = {
  /** En güncel fotoğrafın TARİHİ — çoklu hesapta "çıpa günü" budur. */
  async findLatestAsOfDate(
    tenantId: string,
    onOrBefore: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<string | null> {
    const row = await client.bankBalance.findFirst({
      where: { tenantId, asOfDate: { lte: new Date(onOrBefore) } },
      orderBy: { asOfDate: "desc" },
      select: { asOfDate: true },
    });
    return row ? toIsoDate(row.asOfDate) : null;
  },

  /** Projeksiyonun ÇIPASI: `asOfDate <= onOrBefore` olan EN GÜNCEL GÜNÜN
   * TÜM HESAP fotoğrafları. Tek satır DEĞİL bir LİSTE döner — çoklu hesapta
   * çıpa, o günün bütün hesaplarının toplamıdır. İleri tarihli bir fotoğrafın
   * geçmiş bir pencereye çıpa olması yanlış olurdu, tarih sınırı burada. */
  async findAnchorSnapshots(
    tenantId: string,
    onOrBefore: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankBalanceSnapshot[]> {
    const asOfDate = await this.findLatestAsOfDate(tenantId, onOrBefore, client);
    if (!asOfDate) return [];
    const rows = await client.bankBalance.findMany({
      where: { tenantId, asOfDate: new Date(asOfDate) },
      include: { bankAccount: true },
      orderBy: { bankAccount: { sortOrder: "asc" } },
    });
    return rows.map(toSnapshot);
  },

  async listRecent(
    tenantId: string,
    limit = 20,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankBalanceSnapshot[]> {
    const rows = await client.bankBalance.findMany({
      where: { tenantId },
      include: { bankAccount: true },
      orderBy: [{ asOfDate: "desc" }, { bankAccount: { sortOrder: "asc" } }],
      take: limit,
    });
    return rows.map(toSnapshot);
  },

  async upsert(
    tenantId: string,
    userId: string,
    input: { bankAccountId: string; asOfDate: string; balance: number; note?: string },
  ): Promise<BankBalanceSnapshot> {
    const row = await prisma.bankBalance.upsert({
      where: {
        tenantId_bankAccountId_asOfDate: {
          tenantId,
          bankAccountId: input.bankAccountId,
          asOfDate: new Date(input.asOfDate),
        },
      },
      create: {
        id: crypto.randomUUID(),
        tenantId,
        bankAccountId: input.bankAccountId,
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
      include: { bankAccount: true },
    });
    return toSnapshot(row);
  },
};
