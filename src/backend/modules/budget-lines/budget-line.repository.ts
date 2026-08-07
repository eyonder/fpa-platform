import { getGlobalStore } from "@/backend/core/global-store";
import type { BudgetCategory, BudgetLine, BudgetLineInput } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 * Prisma bağlandığında bu, Budgets/Transactions tablolarını (organization_id
 * + scenario ilişkisi üzerinden) sorgulayan bir katmana dönüşür; service ve
 * üstündeki hiçbir kod değişmez.
 */

const CATEGORIES: BudgetCategory[] = [
  { id: "cat-gelir", name: "Satış Geliri", type: "INCOME", sortOrder: 0 },
  { id: "cat-personel", name: "Personel Giderleri", type: "EXPENSE", sortOrder: 1 },
  { id: "cat-pazarlama", name: "Pazarlama", type: "EXPENSE", sortOrder: 2 },
  { id: "cat-kira", name: "Kira & Ofis", type: "EXPENSE", sortOrder: 3 },
  { id: "cat-saas", name: "Yazılım & SaaS", type: "EXPENSE", sortOrder: 4 },
  { id: "cat-seyahat", name: "Seyahat", type: "EXPENSE", sortOrder: 5 },
  { id: "cat-diger", name: "Diğer Giderler", type: "EXPENSE", sortOrder: 6 },
];

const SEED_AT = "2026-07-15T10:00:00.000Z";

function monthlyLines(
  scenarioId: string,
  categoryId: string,
  amounts: number[],
): BudgetLine[] {
  return amounts.map((amount, index) => ({
    scenarioId,
    categoryId,
    month: index + 1,
    amount,
    updatedAt: SEED_AT,
  }));
}

/** 12 ay boyunca sabit tutar — holding alt şirketleri için (basitlik amaçlı). */
function flatMonthlyLines(
  scenarioId: string,
  categoryId: string,
  monthlyAmount: number,
): BudgetLine[] {
  return monthlyLines(scenarioId, categoryId, Array(12).fill(monthlyAmount));
}

const SCENARIO_MAIN = "b1f2c3d4-0000-4000-8000-000000000001"; // 2026 Ana Bütçe (kilitli)
const SCENARIO_REVISION = "b1f2c3d4-0000-4000-8000-000000000002"; // 2026 Revize 1 (açık, FORECAST)
const SCENARIO_ACTUAL_2026 = "b1f2c3d4-0000-4000-8000-000000000004"; // 2026 Gerçekleşen YTD (açık, ACTUAL)

const seed: BudgetLine[] = [
  // ---- 2026 Ana Bütçe (BUDGET, tam yıl) ----
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-gelir",
    [
      900000, 900000, 950000, 950000, 1000000, 1000000, 1050000, 1050000, 1100000,
      1100000, 1150000, 1150000,
    ],
  ),
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-personel",
    [
      420000, 420000, 430000, 430000, 445000, 445000, 445000, 460000, 460000, 460000,
      475000, 475000,
    ],
  ),
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-pazarlama",
    [
      60000, 55000, 90000, 70000, 65000, 80000, 50000, 45000, 95000, 110000, 130000,
      150000,
    ],
  ),
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-kira",
    [
      38000, 38000, 38000, 38000, 38000, 38000, 38000, 38000, 38000, 38000, 38000,
      38000,
    ],
  ),
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-saas",
    [
      22000, 22000, 22500, 22500, 23000, 23000, 23500, 23500, 24000, 24000, 24500,
      24500,
    ],
  ),
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-seyahat",
    [8000, 6000, 12000, 9000, 10000, 14000, 5000, 4000, 11000, 13000, 9000, 7000],
  ),
  ...monthlyLines(
    SCENARIO_MAIN,
    "cat-diger",
    [
      15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000,
      15000,
    ],
  ),

  // ---- 2026 Revize 1 (FORECAST, sadece Oca-Haz girilmiş, örnek/demo amaçlı) ----
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-gelir",
    [900000, 900000, 950000, 950000, 1000000, 1000000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-personel",
    [420000, 420000, 430000, 430000, 445000, 445000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-pazarlama",
    [60000, 55000, 90000, 70000, 65000, 80000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-kira",
    [38000, 38000, 38000, 38000, 38000, 38000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-saas",
    [22000, 22000, 22500, 22500, 23000, 23000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-seyahat",
    [8000, 6000, 12000, 9000, 10000, 14000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_REVISION,
    "cat-diger",
    [15000, 15000, 15000, 15000, 15000, 15000, 0, 0, 0, 0, 0, 0],
  ),

  // ---- 2026 Gerçekleşen YTD (ACTUAL, Oca-Haz kapandı, Tem-Ara henüz yok) ----
  // Bilerek bütçeden sapmalı: sapma analizi ve forecast servislerini test etmek için.
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-gelir",
    [905000, 890000, 970000, 940000, 1030000, 1080000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-personel",
    [425000, 418000, 432000, 435000, 450000, 447000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-pazarlama",
    [65000, 50000, 95000, 72000, 60000, 85000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-kira",
    [38000, 38000, 38000, 38000, 38000, 38000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-saas",
    [21000, 21500, 22000, 22000, 22500, 22800, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-seyahat",
    [7500, 6200, 13000, 8500, 9800, 15000, 0, 0, 0, 0, 0, 0],
  ),
  ...monthlyLines(
    SCENARIO_ACTUAL_2026,
    "cat-diger",
    [15000, 15000, 15000, 15000, 15000, 15000, 0, 0, 0, 0, 0, 0],
  ),

  // ---- Holding yapısı (konsolidasyon demo verisi) — tümü sabit aylık tutar ----
  // Her şirket KENDİ para biriminde kayıt tutar; konsolidasyon servisi bunu
  // ana şirketin para birimine çevirip toplar (bkz. consolidation.service.ts).

  // Holding'in kendi (merkez ofis) bütçesi, TRY.
  ...flatMonthlyLines("sc-holding-2026-budget", "cat-personel", 80000),
  ...flatMonthlyLines("sc-holding-2026-budget", "cat-diger", 10000),

  // Acme Türkiye A.Ş., TRY.
  ...flatMonthlyLines("sc-tr-2026-budget", "cat-gelir", 300000),
  ...flatMonthlyLines("sc-tr-2026-budget", "cat-personel", 120000),
  ...flatMonthlyLines("sc-tr-2026-budget", "cat-pazarlama", 20000),
  ...flatMonthlyLines("sc-tr-2026-budget", "cat-kira", 15000),

  // Acme Deutschland GmbH, EUR.
  ...flatMonthlyLines("sc-de-2026-budget", "cat-gelir", 85000),
  ...flatMonthlyLines("sc-de-2026-budget", "cat-personel", 35000),
  ...flatMonthlyLines("sc-de-2026-budget", "cat-pazarlama", 6000),
  ...flatMonthlyLines("sc-de-2026-budget", "cat-kira", 4000),

  // Acme USA Inc., USD.
  ...flatMonthlyLines("sc-us-2026-budget", "cat-gelir", 95000),
  ...flatMonthlyLines("sc-us-2026-budget", "cat-personel", 40000),
  ...flatMonthlyLines("sc-us-2026-budget", "cat-pazarlama", 7000),
  ...flatMonthlyLines("sc-us-2026-budget", "cat-kira", 4500),
];

/** Anahtar: scenarioId::categoryId::month */
const key = (scenarioId: string, categoryId: string, month: number) =>
  `${scenarioId}::${categoryId}::${month}`;

// getGlobalStore kullanımı için bkz. auth/session.repository.ts'teki not.
const store = getGlobalStore(
  "budget-lines",
  () =>
    new Map<string, BudgetLine>(
      seed.map((line) => [key(line.scenarioId, line.categoryId, line.month), line]),
    ),
);

export const budgetLineRepository = {
  async findCategories(): Promise<BudgetCategory[]> {
    return [...CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async findByScenario(scenarioId: string): Promise<BudgetLine[]> {
    return [...store.values()].filter((line) => line.scenarioId === scenarioId);
  },

  async bulkUpsert(
    scenarioId: string,
    inputs: BudgetLineInput[],
  ): Promise<BudgetLine[]> {
    const now = new Date().toISOString();
    const updated: BudgetLine[] = [];

    for (const input of inputs) {
      const line: BudgetLine = {
        scenarioId,
        categoryId: input.categoryId,
        month: input.month,
        amount: input.amount,
        updatedAt: now,
      };
      store.set(key(scenarioId, input.categoryId, input.month), line);
      updated.push(line);
    }

    return updated;
  },
};
