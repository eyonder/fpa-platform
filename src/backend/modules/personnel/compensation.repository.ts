import { decrypt, encrypt } from "@/backend/core/crypto";
import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { CreateCompensationInput, EmployeeCompensation } from "@/shared/types";
import type { EmployeeCompensation as CompensationRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `EmployeeCompensation` RLS'e TABİDİR. Tutar VE diğer bordro girdileri
 * (yemek/yol günü, planlı fazla mesai, teşvik uygulanacak mı) DB'de düz
 * metin DEĞİL — `compensationCiphertext` içinde AES-256-GCM şifreli JSON
 * olarak saklanır (bkz. backend/core/crypto.ts, mfa.repository.ts'teki
 * aynı desen). Bu, roadmap'in "RLS + özel şifreleme katmanı" gereksinimini
 * karşılar — RLS tenant izolasyonunu, şifreleme ise DB sızıntısına karşı
 * ikinci bir katmanı sağlar.
 */

interface DecryptedPayload {
  amountMinor: number;
  mealAllowanceDays: number;
  transportAllowanceDays: number;
  plannedOvertimeHoursPerMonth: number;
  applyEmployerIncentive: boolean;
}

function toDomain(row: CompensationRow): EmployeeCompensation {
  const payload = JSON.parse(decrypt(row.compensationCiphertext)) as DecryptedPayload;
  return {
    id: row.id,
    employeeId: row.employeeId,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    inputMode: row.inputMode,
    amount: fromMinorUnits(payload.amountMinor),
    mealAllowanceDays: payload.mealAllowanceDays,
    transportAllowanceDays: payload.transportAllowanceDays,
    plannedOvertimeHoursPerMonth: payload.plannedOvertimeHoursPerMonth,
    applyEmployerIncentive: payload.applyEmployerIncentive,
  };
}

export const compensationRepository = {
  async findByEmployee(
    tenantId: string,
    employeeId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<EmployeeCompensation[]> {
    const rows = await client.employeeCompensation.findMany({
      where: { tenantId, employeeId },
      orderBy: { effectiveFrom: "asc" },
    });
    return rows.map(toDomain);
  },

  /** Belirli bir tarihte YÜRÜRLÜKTE olan (effectiveFrom <= asOfDate, en yeni) ücret kaydı. */
  async findEffectiveAsOf(
    tenantId: string,
    employeeId: string,
    asOfDate: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<EmployeeCompensation | null> {
    const row = await client.employeeCompensation.findFirst({
      where: { tenantId, employeeId, effectiveFrom: { lte: new Date(asOfDate) } },
      orderBy: { effectiveFrom: "desc" },
    });
    return row ? toDomain(row) : null;
  },

  async create(
    tenantId: string,
    employeeId: string,
    input: CreateCompensationInput,
  ): Promise<EmployeeCompensation> {
    const payload: DecryptedPayload = {
      amountMinor: toMinorUnits(input.amount),
      mealAllowanceDays: input.mealAllowanceDays ?? 0,
      transportAllowanceDays: input.transportAllowanceDays ?? 0,
      plannedOvertimeHoursPerMonth: input.plannedOvertimeHoursPerMonth ?? 0,
      applyEmployerIncentive: input.applyEmployerIncentive ?? false,
    };

    const row = await prisma.employeeCompensation.create({
      data: {
        id: crypto.randomUUID(),
        employeeId,
        tenantId,
        effectiveFrom: new Date(input.effectiveFrom),
        inputMode: input.inputMode,
        compensationCiphertext: encrypt(JSON.stringify(payload)),
      },
    });
    return toDomain(row);
  },
};
