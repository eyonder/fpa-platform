import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type { BankAccount, CreateBankAccountInput } from "@/shared/types";
import type { BankAccount as BankAccountRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `BankAccount` RLS'e TABİDİR. BİR HESAP = BİR PARA BİRİMİ; aynı bankanın
 * TL/USD/EUR bakiyeleri AYRI kayıtlardır (`@@unique([tenantId, bankName,
 * currency])`). Tutar SAKLANMAZ burada — bakiyeler `BankBalance`, hareketler
 * `BankTransaction` tarafındadır ve HEP hesabın kendi para birimindedir.
 */

function toBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    bankName: row.bankName,
    currency: row.currency,
    iban: row.iban,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const bankAccountRepository = {
  async findByTenant(
    tenantId: string,
    filters: { onlyActive?: boolean } = {},
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankAccount[]> {
    const rows = await client.bankAccount.findMany({
      where: { tenantId, ...(filters.onlyActive ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { bankName: "asc" }, { currency: "asc" }],
    });
    return rows.map(toBankAccount);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankAccount | null> {
    const row = await client.bankAccount.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toBankAccount(row) : null;
  },

  async create(
    tenantId: string,
    userId: string,
    input: CreateBankAccountInput,
  ): Promise<BankAccount> {
    const row = await prisma.bankAccount.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        bankName: input.bankName,
        currency: input.currency,
        iban: input.iban ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        createdByUserId: userId,
      },
    });
    return toBankAccount(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: Partial<CreateBankAccountInput>,
  ): Promise<BankAccount | null> {
    const result = await prisma.bankAccount.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.iban !== undefined ? { iban: input.iban } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },
};
