import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type { CreateEmployeeInput, DisabilityDegree, Employee } from "@/shared/types";
import type { Employee as EmployeeRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `Employee` RLS'e TABİDİR (Scenario/BudgetLine/AuditLog/ImportJob setine
 * katılır) — bkz. prisma/migrations/*_enable_rls_personnel/migration.sql.
 * Maaş verisinin KENDİSİ burada değil, compensation.repository.ts'te
 * (şifreli) tutulur.
 */

export interface UpdateEmployeeInput {
  fullName?: string;
  position?: string;
  department?: string | null;
  isRetired?: boolean;
  isConcierge?: boolean;
  disabilityDegree?: DisabilityDegree;
  isActive?: boolean;
  terminationDate?: string | null;
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    tenantId: row.tenantId,
    fullName: row.fullName,
    position: row.position,
    department: row.department,
    hireDate: row.hireDate.toISOString().slice(0, 10),
    terminationDate: row.terminationDate
      ? row.terminationDate.toISOString().slice(0, 10)
      : null,
    isActive: row.isActive,
    isRetired: row.isRetired,
    isConcierge: row.isConcierge,
    disabilityDegree: row.disabilityDegree,
  };
}

export const employeeRepository = {
  async findMany(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<Employee[]> {
    const rows = await client.employee.findMany({
      where: { tenantId },
      orderBy: { fullName: "asc" },
    });
    return rows.map(toEmployee);
  },

  async findActive(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<Employee[]> {
    const rows = await client.employee.findMany({
      where: { tenantId, isActive: true },
      orderBy: { fullName: "asc" },
    });
    return rows.map(toEmployee);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<Employee | null> {
    const row = await client.employee.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toEmployee(row) : null;
  },

  async create(tenantId: string, input: CreateEmployeeInput): Promise<Employee> {
    const row = await prisma.employee.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        fullName: input.fullName,
        position: input.position,
        department: input.department ?? null,
        hireDate: new Date(input.hireDate),
        isRetired: input.isRetired ?? false,
        isConcierge: input.isConcierge ?? false,
        disabilityDegree: input.disabilityDegree ?? "NONE",
      },
    });
    return toEmployee(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<Employee | null> {
    // `updateMany` KASITLI: yanlış tenant'a ait bir id verilirse (RLS zaten
    // engeller, burası ikinci savunma hattı) sessizce 0 satır güncellenir —
    // diğer repository'lerdeki aynı disiplin (bkz. scenario.repository.ts).
    const result = await prisma.employee.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.isRetired !== undefined ? { isRetired: input.isRetired } : {}),
        ...(input.isConcierge !== undefined ? { isConcierge: input.isConcierge } : {}),
        ...(input.disabilityDegree !== undefined
          ? { disabilityDegree: input.disabilityDegree }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.terminationDate !== undefined
          ? {
              terminationDate: input.terminationDate
                ? new Date(input.terminationDate)
                : null,
            }
          : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },
};
