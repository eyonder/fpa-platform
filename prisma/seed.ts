import { PrismaPg } from "@prisma/adapter-pg";
import { BudgetCategoryType, PrismaClient, Role, ScenarioKind } from "@prisma/client";
import bcrypt from "bcryptjs";

import { toMinorUnits } from "../src/shared/lib/money";

/**
 * Demo verisini üretir — eski `global-store.ts` tabanlı repository'lerdeki
 * (users/organizations/scenarios/budget-lines/fx-rate) hardcoded seed'lerin
 * BİREBİR karşılığıdır, `npm run dev` migration sonrası aynı demo deneyimini
 * versin diye.
 *
 * KASITLI OLARAK `DATABASE_URL` (owner/superuser "fpa") kullanır, uygulamanın
 * RLS'e tabi `APP_DATABASE_URL`'i DEĞİL — tek seferde BİRDEN ÇOK tenant'a
 * veri yazar, bu da RLS'in "aktif bağlamda tek tenant" varsayımıyla zaten
 * uyuşmaz (bkz. backend/core/prisma-client.ts'teki `prismaBypassRls` notu).
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD_HASH = bcrypt.hashSync("Demo1234!", 10);
const SEED_AT = new Date("2026-07-15T10:00:00.000Z");

const SCENARIO_MAIN = "b1f2c3d4-0000-4000-8000-000000000001";
const SCENARIO_REVISION = "b1f2c3d4-0000-4000-8000-000000000002";
const SCENARIO_ACTUAL_2025 = "b1f2c3d4-0000-4000-8000-000000000003";
const SCENARIO_ACTUAL_2026 = "b1f2c3d4-0000-4000-8000-000000000004";

/** Bütçe satırı → tenant eşlemesi (RLS + index için denormalize kolon). */
const SCENARIO_TENANT: Record<string, string> = {
  [SCENARIO_MAIN]: "demo-tenant",
  [SCENARIO_REVISION]: "demo-tenant",
  [SCENARIO_ACTUAL_2025]: "demo-tenant",
  [SCENARIO_ACTUAL_2026]: "demo-tenant",
  "sc-holding-2026-budget": "org-holding",
  "sc-tr-2026-budget": "org-tr",
  "sc-de-2026-budget": "org-de",
  "sc-us-2026-budget": "org-us",
};

interface BudgetLineRow {
  scenarioId: string;
  categoryId: string;
  month: number;
  tenantId: string;
  amountMinor: bigint;
  updatedAt: Date;
}

function monthlyLines(
  scenarioId: string,
  categoryId: string,
  amounts: number[],
): BudgetLineRow[] {
  const tenantId = SCENARIO_TENANT[scenarioId];
  return amounts.map((amount, index) => ({
    scenarioId,
    categoryId,
    month: index + 1,
    tenantId,
    amountMinor: BigInt(toMinorUnits(amount)),
    updatedAt: SEED_AT,
  }));
}

/** 12 ay boyunca sabit tutar — holding alt şirketleri için (basitlik amaçlı). */
function flatMonthlyLines(
  scenarioId: string,
  categoryId: string,
  monthlyAmount: number,
): BudgetLineRow[] {
  return monthlyLines(scenarioId, categoryId, Array(12).fill(monthlyAmount));
}

async function resetDatabase() {
  // Bağımlılık sırasına göre (çocuktan ebeveyne) sil — cascade kurallarına
  // güvenmek yerine açık ve tahmin edilebilir.
  await prisma.budgetLine.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fxRate.deleteMany();
}

async function seedTenants() {
  await prisma.tenant.createMany({
    data: [
      {
        id: "demo-tenant",
        name: "Demo A.Ş.",
        parentTenantId: null,
        baseCurrency: "TRY",
      },
      {
        id: "org-holding",
        name: "Acme Holding A.Ş.",
        parentTenantId: null,
        baseCurrency: "TRY",
      },
      {
        id: "org-tr",
        name: "Acme Türkiye A.Ş.",
        parentTenantId: "org-holding",
        baseCurrency: "TRY",
      },
      {
        id: "org-de",
        name: "Acme Deutschland GmbH",
        parentTenantId: "org-holding",
        baseCurrency: "EUR",
      },
      {
        id: "org-us",
        name: "Acme USA Inc.",
        parentTenantId: "org-holding",
        baseCurrency: "USD",
      },
    ],
  });
}

async function seedUsersAndMemberships() {
  await prisma.user.createMany({
    data: [
      {
        id: "user-demo-admin",
        name: "Aylin Admin",
        email: "aylin@demo-tenant.test",
        passwordHash: DEMO_PASSWORD_HASH,
      },
      {
        id: "user-demo-budget-manager",
        name: "Barış Bütçe",
        email: "baris@demo-tenant.test",
        passwordHash: DEMO_PASSWORD_HASH,
      },
      {
        id: "user-demo-data-entry",
        name: "Deniz Data",
        email: "deniz@demo-tenant.test",
        passwordHash: DEMO_PASSWORD_HASH,
      },
      {
        id: "user-holding-admin",
        name: "Hale Holding",
        email: "hale@org-holding.test",
        passwordHash: DEMO_PASSWORD_HASH,
      },
    ],
  });

  // SIRA ÖNEMLİ: Membership.id (autoincrement) buradaki ekleme sırasıyla
  // atanır; `userRepository.findMembershipsByUser` bunu `ORDER BY id ASC`
  // ile okur ve `authService.login`'deki "ilk üyelik = birincil tenant"
  // mantığı buna dayanır — bugünkü sabit dizi sırasıyla BİREBİR aynı olmalı.
  // Bu yüzden `createMany` değil, sıralı `create` kullanılır.
  const memberships: { userId: string; tenantId: string; role: Role }[] = [
    { userId: "user-demo-admin", tenantId: "demo-tenant", role: Role.ADMIN },
    {
      userId: "user-demo-budget-manager",
      tenantId: "demo-tenant",
      role: Role.BUDGET_MANAGER,
    },
    { userId: "user-demo-data-entry", tenantId: "demo-tenant", role: Role.DATA_ENTRY },
    { userId: "user-holding-admin", tenantId: "org-holding", role: Role.ADMIN },
    { userId: "user-holding-admin", tenantId: "org-tr", role: Role.ADMIN },
    { userId: "user-holding-admin", tenantId: "org-de", role: Role.ADMIN },
    { userId: "user-holding-admin", tenantId: "org-us", role: Role.ADMIN },
  ];
  for (const membership of memberships) {
    await prisma.membership.create({ data: membership });
  }
}

async function seedScenarios() {
  await prisma.scenario.createMany({
    data: [
      {
        id: SCENARIO_MAIN,
        tenantId: "demo-tenant",
        name: "2026 Ana Bütçe",
        kind: ScenarioKind.BUDGET,
        fiscalYear: 2026,
        isLocked: true,
        baseCurrency: "TRY",
        updatedAt: new Date("2026-01-14T09:12:00.000Z"),
      },
      {
        id: SCENARIO_REVISION,
        tenantId: "demo-tenant",
        name: "2026 Revize 1",
        kind: ScenarioKind.FORECAST,
        fiscalYear: 2026,
        isLocked: false,
        baseCurrency: "TRY",
        updatedAt: new Date("2026-07-02T16:40:00.000Z"),
      },
      {
        id: SCENARIO_ACTUAL_2025,
        tenantId: "demo-tenant",
        name: "2025 Gerçekleşen",
        kind: ScenarioKind.ACTUAL,
        fiscalYear: 2025,
        isLocked: true,
        baseCurrency: "TRY",
        updatedAt: new Date("2026-02-28T11:05:00.000Z"),
      },
      {
        id: SCENARIO_ACTUAL_2026,
        tenantId: "demo-tenant",
        name: "2026 Gerçekleşen (YTD)",
        kind: ScenarioKind.ACTUAL,
        fiscalYear: 2026,
        isLocked: false,
        baseCurrency: "TRY",
        updatedAt: new Date("2026-07-20T08:00:00.000Z"),
      },
      {
        id: "sc-holding-2026-budget",
        tenantId: "org-holding",
        name: "2026 Holding Bütçesi",
        kind: ScenarioKind.BUDGET,
        fiscalYear: 2026,
        isLocked: false,
        baseCurrency: "TRY",
        updatedAt: new Date("2026-06-01T09:00:00.000Z"),
      },
      {
        id: "sc-tr-2026-budget",
        tenantId: "org-tr",
        name: "2026 Bütçe",
        kind: ScenarioKind.BUDGET,
        fiscalYear: 2026,
        isLocked: false,
        baseCurrency: "TRY",
        updatedAt: new Date("2026-06-01T09:00:00.000Z"),
      },
      {
        id: "sc-de-2026-budget",
        tenantId: "org-de",
        name: "2026 Budget",
        kind: ScenarioKind.BUDGET,
        fiscalYear: 2026,
        isLocked: false,
        baseCurrency: "EUR",
        updatedAt: new Date("2026-06-01T09:00:00.000Z"),
      },
      {
        id: "sc-us-2026-budget",
        tenantId: "org-us",
        name: "2026 Budget",
        kind: ScenarioKind.BUDGET,
        fiscalYear: 2026,
        isLocked: false,
        baseCurrency: "USD",
        updatedAt: new Date("2026-06-01T09:00:00.000Z"),
      },
    ],
  });
}

async function seedBudgetCategoriesAndLines() {
  await prisma.budgetCategory.createMany({
    data: [
      {
        id: "cat-gelir",
        name: "Satış Geliri",
        type: BudgetCategoryType.INCOME,
        sortOrder: 0,
      },
      {
        id: "cat-personel",
        name: "Personel Giderleri",
        type: BudgetCategoryType.EXPENSE,
        sortOrder: 1,
      },
      {
        id: "cat-pazarlama",
        name: "Pazarlama",
        type: BudgetCategoryType.EXPENSE,
        sortOrder: 2,
      },
      {
        id: "cat-kira",
        name: "Kira & Ofis",
        type: BudgetCategoryType.EXPENSE,
        sortOrder: 3,
      },
      {
        id: "cat-saas",
        name: "Yazılım & SaaS",
        type: BudgetCategoryType.EXPENSE,
        sortOrder: 4,
      },
      {
        id: "cat-seyahat",
        name: "Seyahat",
        type: BudgetCategoryType.EXPENSE,
        sortOrder: 5,
      },
      {
        id: "cat-diger",
        name: "Diğer Giderler",
        type: BudgetCategoryType.EXPENSE,
        sortOrder: 6,
      },
    ],
  });

  const lines: BudgetLineRow[] = [
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

    // ---- 2026 Revize 1 (FORECAST, sadece Oca-Haz girilmiş) ----
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

    // ---- 2026 Gerçekleşen YTD (ACTUAL, Oca-Haz kapandı) — bilerek bütçeden sapmalı ----
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

    // ---- Holding yapısı (konsolidasyon demo verisi) — sabit aylık tutar ----
    ...flatMonthlyLines("sc-holding-2026-budget", "cat-personel", 80000),
    ...flatMonthlyLines("sc-holding-2026-budget", "cat-diger", 10000),

    ...flatMonthlyLines("sc-tr-2026-budget", "cat-gelir", 300000),
    ...flatMonthlyLines("sc-tr-2026-budget", "cat-personel", 120000),
    ...flatMonthlyLines("sc-tr-2026-budget", "cat-pazarlama", 20000),
    ...flatMonthlyLines("sc-tr-2026-budget", "cat-kira", 15000),

    ...flatMonthlyLines("sc-de-2026-budget", "cat-gelir", 85000),
    ...flatMonthlyLines("sc-de-2026-budget", "cat-personel", 35000),
    ...flatMonthlyLines("sc-de-2026-budget", "cat-pazarlama", 6000),
    ...flatMonthlyLines("sc-de-2026-budget", "cat-kira", 4000),

    ...flatMonthlyLines("sc-us-2026-budget", "cat-gelir", 95000),
    ...flatMonthlyLines("sc-us-2026-budget", "cat-personel", 40000),
    ...flatMonthlyLines("sc-us-2026-budget", "cat-pazarlama", 7000),
    ...flatMonthlyLines("sc-us-2026-budget", "cat-kira", 4500),
  ];

  await prisma.budgetLine.createMany({ data: lines });
}

async function seedFxRates() {
  await prisma.fxRate.createMany({
    data: [
      { date: new Date("2026-08-01"), base: "USD", quote: "TRY", rate: 34.1 },
      { date: new Date("2026-08-05"), base: "USD", quote: "TRY", rate: 34.25 },
      { date: new Date("2026-08-06"), base: "USD", quote: "TRY", rate: 34.3 },
      { date: new Date("2026-08-01"), base: "EUR", quote: "TRY", rate: 37.05 },
      { date: new Date("2026-08-05"), base: "EUR", quote: "TRY", rate: 37.2 },
      { date: new Date("2026-08-06"), base: "EUR", quote: "TRY", rate: 37.28 },
    ],
  });
}

async function main() {
  await resetDatabase();
  await seedTenants();
  await seedUsersAndMemberships();
  await seedScenarios();
  await seedBudgetCategoriesAndLines();
  await seedFxRates();
  console.log("Seed tamamlandı.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
