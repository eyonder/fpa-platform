import { prismaAsTxClient, withTenantTransaction } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type { AllocationKey } from "@/shared/types";
import type {
  AllocationKey as AllocationKeyRow,
  AllocationKeyMember as AllocationKeyMemberRow,
} from "@prisma/client";

import type { UpsertAllocationKeyInput } from "./cost-center.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * Bir kaynak gider merkezinin EN FAZLA bir `AllocationKey`'i olabilir (bkz.
 * `@@unique([tenantId, sourceCostCenterId])`, prisma/schema.prisma). `upsert`
 * bu yüzden "oluştur YA DA üye listesini TAMAMEN değiştir" anlamına gelir —
 * ayrı bir PATCH/üye-bazlı güncelleme yolu YOK, `budget-lines`teki toplu
 * (bulk) değiştirme disipliniyle aynı basitlik tercihi.
 */

type AllocationKeyWithMembers = AllocationKeyRow & {
  members: AllocationKeyMemberRow[];
};

function toAllocationKey(row: AllocationKeyWithMembers): AllocationKey {
  return {
    id: row.id,
    sourceCostCenterId: row.sourceCostCenterId,
    name: row.name,
    members: row.members.map((m) => ({
      costCenterId: m.costCenterId,
      weightPercent: Number(m.weightPercent),
    })),
  };
}

export const allocationKeyRepository = {
  async findBySourceCostCenter(
    tenantId: string,
    sourceCostCenterId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<AllocationKey | null> {
    const row = await client.allocationKey.findFirst({
      where: { tenantId, sourceCostCenterId },
      include: { members: true },
    });
    return row ? toAllocationKey(row) : null;
  },

  async findByTenant(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<AllocationKey[]> {
    const rows = await client.allocationKey.findMany({
      where: { tenantId },
      include: { members: true },
    });
    return rows.map(toAllocationKey);
  },

  /**
   * Anahtarı oluşturur ya da varsa üye listesini TAMAMEN değiştirir (bkz.
   * dosya başı not). Çok adımlı bir tenant yazma akışı olduğu için
   * `withTenantTransaction` kullanır (bkz. prisma-client.ts'teki not) —
   * `prisma`'nın otomatik `$allOperations` sarmalaması AÇIK bir transaction'a
   * İÇ İÇE GİREMEZ, bu yüzden düz `prisma.$transaction` YANLIŞ olurdu.
   */
  async upsert(
    tenantId: string,
    sourceCostCenterId: string,
    input: UpsertAllocationKeyInput,
  ): Promise<AllocationKey> {
    return withTenantTransaction(tenantId, async (tx) => {
      const existing = await tx.allocationKey.findFirst({
        where: { tenantId, sourceCostCenterId },
      });

      const keyId = existing?.id ?? crypto.randomUUID();

      await tx.allocationKey.upsert({
        where: { id: keyId },
        create: { id: keyId, tenantId, sourceCostCenterId, name: input.name },
        update: { name: input.name },
      });

      // Üye listesini TAMAMEN değiştir: eskiler silinir, yenileri yazılır —
      // bulkUpsertBudgetLines'daki "sınırlı hacim, sıralı işlem yeterli"
      // disipliniyle aynı basitlik (bir anahtarın üye sayısı küçüktür).
      await tx.allocationKeyMember.deleteMany({ where: { allocationKeyId: keyId } });
      await tx.allocationKeyMember.createMany({
        data: input.members.map((m) => ({
          id: crypto.randomUUID(),
          tenantId,
          allocationKeyId: keyId,
          costCenterId: m.costCenterId,
          weightPercent: m.weightPercent,
        })),
      });

      const row = await tx.allocationKey.findUniqueOrThrow({
        where: { id: keyId },
        include: { members: true },
      });

      return toAllocationKey(row);
    });
  },
};
