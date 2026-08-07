import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type { Scenario } from "@/shared/types";
import type { Scenario as ScenarioRow } from "@prisma/client";

import type { CreateScenarioInput, ListScenariosQuery } from "./scenario.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `Scenario`, RLS'e tabi OLAN ilk tablo (bkz. `prisma/migrations/*_enable_rls`).
 * Her sorguda hâlâ `tenantId` ile de filtrelenir — bu, PostgreSQL RLS'in
 * uygulama tarafındaki İKİNCİ savunma hattıdır (RLS birinci, `SET LOCAL
 * app.current_tenant_id` ile `backend/core/prisma-client.ts`teki Client
 * Extension tarafından otomatik kurulur — bu repository'nin bundan HABERİ
 * yoktur, sadece normal Prisma sorguları yazar).
 */

function toScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    kind: row.kind,
    fiscalYear: row.fiscalYear,
    isLocked: row.isLocked,
    baseCurrency: row.baseCurrency,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const scenarioRepository = {
  async findMany(
    tenantId: string,
    query: ListScenariosQuery,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<Scenario[]> {
    const rows = await client.scenario.findMany({
      where: {
        tenantId,
        ...(query.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toScenario);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<Scenario | null> {
    const row = await client.scenario.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toScenario(row) : null;
  },

  async findByName(tenantId: string, name: string): Promise<Scenario | null> {
    const row = await prisma.scenario.findFirst({
      where: { tenantId, name: { equals: name, mode: "insensitive" } },
    });
    return row ? toScenario(row) : null;
  },

  async create(tenantId: string, input: CreateScenarioInput): Promise<Scenario> {
    const row = await prisma.scenario.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        isLocked: false,
        name: input.name,
        kind: input.kind,
        fiscalYear: input.fiscalYear,
        baseCurrency: input.baseCurrency,
      },
    });
    return toScenario(row);
  },

  /** Kilitleme/kilit açma — bkz. Scenario.isLocked notu: bu, "onaylama" eylemidir. */
  async setLocked(
    tenantId: string,
    id: string,
    isLocked: boolean,
  ): Promise<Scenario | null> {
    // `updateMany` KASITLI: `where`'e `tenantId`'yi de katarak, yanlış
    // tenant'a ait bir id verilirse (RLS zaten engeller ama burası ikinci
    // savunma hattı) sessizce 0 satır güncellenir — `update` gibi P2025
    // fırlatmaz, orijinal "bulunamadıysa null dön" davranışıyla eşleşir.
    const result = await prisma.scenario.updateMany({
      where: { id, tenantId },
      data: { isLocked },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },
};
