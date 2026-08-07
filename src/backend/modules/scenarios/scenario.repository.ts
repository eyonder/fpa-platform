import { getGlobalStore } from "@/backend/core/global-store";
import type { Scenario } from "@/shared/types";

import type { CreateScenarioInput, ListScenariosQuery } from "./scenario.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner. Prisma bağlandığında SADECE bu dosya değişir;
 * service, route ve UI kodlarına dokunulmaz. Ayrıca her sorgu tenantId ile
 * filtrelenir — bu, PostgreSQL RLS'in uygulama tarafındaki ikinci savunma hattıdır.
 *
 * `getGlobalStore` kullanımı için bkz. auth/session.repository.ts'teki not
 * (route handler ile server component arasında paylaşılan gerçek tekil state).
 */

const seed: Scenario[] = [
  {
    id: "b1f2c3d4-0000-4000-8000-000000000001",
    tenantId: "demo-tenant",
    name: "2026 Ana Bütçe",
    kind: "BUDGET",
    fiscalYear: 2026,
    isLocked: true,
    baseCurrency: "TRY",
    updatedAt: "2026-01-14T09:12:00.000Z",
  },
  {
    id: "b1f2c3d4-0000-4000-8000-000000000002",
    tenantId: "demo-tenant",
    name: "2026 Revize 1",
    kind: "FORECAST",
    fiscalYear: 2026,
    isLocked: false,
    baseCurrency: "TRY",
    updatedAt: "2026-07-02T16:40:00.000Z",
  },
  {
    id: "b1f2c3d4-0000-4000-8000-000000000003",
    tenantId: "demo-tenant",
    name: "2025 Gerçekleşen",
    kind: "ACTUAL",
    fiscalYear: 2025,
    isLocked: true,
    baseCurrency: "TRY",
    updatedAt: "2026-02-28T11:05:00.000Z",
  },
  {
    id: "b1f2c3d4-0000-4000-8000-000000000004",
    tenantId: "demo-tenant",
    name: "2026 Gerçekleşen (YTD)",
    kind: "ACTUAL",
    fiscalYear: 2026,
    // Kapanan aylar geldikçe finans ekibi girer; yıl kapanana kadar açık kalır.
    isLocked: false,
    baseCurrency: "TRY",
    updatedAt: "2026-07-20T08:00:00.000Z",
  },

  // ---- Holding yapısı (konsolidasyon modülü demo verisi) ----
  // Her satırın tenantId'si organizationRepository'deki ilgili Organization.id
  // ile birebir aynı — her alt şirket kendi tenant'ıdır (bkz. organization.repository.ts).
  {
    id: "sc-holding-2026-budget",
    tenantId: "org-holding",
    name: "2026 Holding Bütçesi",
    kind: "BUDGET",
    fiscalYear: 2026,
    isLocked: false,
    baseCurrency: "TRY",
    updatedAt: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "sc-tr-2026-budget",
    tenantId: "org-tr",
    name: "2026 Bütçe",
    kind: "BUDGET",
    fiscalYear: 2026,
    isLocked: false,
    baseCurrency: "TRY",
    updatedAt: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "sc-de-2026-budget",
    tenantId: "org-de",
    name: "2026 Budget",
    kind: "BUDGET",
    fiscalYear: 2026,
    isLocked: false,
    baseCurrency: "EUR",
    updatedAt: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "sc-us-2026-budget",
    tenantId: "org-us",
    name: "2026 Budget",
    kind: "BUDGET",
    fiscalYear: 2026,
    isLocked: false,
    baseCurrency: "USD",
    updatedAt: "2026-06-01T09:00:00.000Z",
  },
];

const store = getGlobalStore(
  "scenarios",
  () => new Map<string, Scenario>(seed.map((s) => [s.id, s])),
);

export const scenarioRepository = {
  async findMany(tenantId: string, query: ListScenariosQuery): Promise<Scenario[]> {
    return [...store.values()]
      .filter((s) => s.tenantId === tenantId)
      .filter((s) => (query.fiscalYear ? s.fiscalYear === query.fiscalYear : true))
      .filter((s) => (query.kind ? s.kind === query.kind : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async findById(tenantId: string, id: string): Promise<Scenario | null> {
    const hit = store.get(id);
    return hit && hit.tenantId === tenantId ? hit : null;
  },

  async findByName(tenantId: string, name: string): Promise<Scenario | null> {
    const hit = [...store.values()].find(
      (s) => s.tenantId === tenantId && s.name.toLowerCase() === name.toLowerCase(),
    );
    return hit ?? null;
  },

  async create(tenantId: string, input: CreateScenarioInput): Promise<Scenario> {
    const scenario: Scenario = {
      id: crypto.randomUUID(),
      tenantId,
      isLocked: false,
      updatedAt: new Date().toISOString(),
      ...input,
    };
    store.set(scenario.id, scenario);
    return scenario;
  },

  /** Kilitleme/kilit açma — bkz. Scenario.isLocked notu: bu, "onaylama" eylemidir. */
  async setLocked(
    tenantId: string,
    id: string,
    isLocked: boolean,
  ): Promise<Scenario | null> {
    const hit = store.get(id);
    if (!hit || hit.tenantId !== tenantId) return null;

    const updated: Scenario = { ...hit, isLocked, updatedAt: new Date().toISOString() };
    store.set(id, updated);
    return updated;
  },
};
