import { PrismaPg } from "@prisma/adapter-pg";
import { BudgetCategoryType, PrismaClient, Role, ScenarioKind } from "@prisma/client";
import bcrypt from "bcryptjs";

import { encrypt } from "../src/backend/core/crypto";
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
  categoryCode: string,
  amounts: number[],
): BudgetLineRow[] {
  const tenantId = SCENARIO_TENANT[scenarioId];
  // Kategori id'si artık tenant'a özel — çağrı yerleri sade KODU geçmeye
  // devam eder, id burada tek noktada kurulur.
  const categoryId = `${tenantId}:${categoryCode}`;
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
  categoryCode: string,
  monthlyAmount: number,
): BudgetLineRow[] {
  return monthlyLines(scenarioId, categoryCode, Array(12).fill(monthlyAmount));
}

async function resetDatabase() {
  // Bağımlılık sırasına göre (çocuktan ebeveyne) sil — cascade kurallarına
  // güvenmek yerine açık ve tahmin edilebilir.
  await prisma.employeeCompensation.deleteMany();
  await prisma.mfaBackupCode.deleteMany();
  await prisma.mfaChallenge.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.importJob.deleteMany();
  // Faz 2.2/2.3 eklendiğinde BURAYA eklenmemişti (Tenant cascade'i ile
  // dolaylı temizleniyordu, zararsız ama "açık, cascade'e güvenme"
  // felsefesiyle tutarsızdı) — şimdi düzeltildi.
  await prisma.expenseEntry.deleteMany();
  await prisma.allocationKeyMember.deleteMany();
  await prisma.allocationKey.deleteMany();
  await prisma.costCenter.deleteMany();
  await prisma.fixedAsset.deleteMany();
  await prisma.salesBillingMilestone.deleteMany();
  await prisma.salesOpportunity.deleteMany();
  // Hazine (Treasury): BankTransaction -> CashFlowEvent -> (MappingConfig,
  // TreasuryImportBatch), hepsi Scenario/BudgetCategory silinmeden ÖNCE
  // (bkz. prisma/schema.prisma'daki 14. bölüm notu — CashFlowEvent'in
  // üçüne de FK'sı var; TreasuryImportBatch.events TERS ilişkidir, FK
  // fiziksel olarak CashFlowEvent tarafında).
  await prisma.bankTransaction.deleteMany();
  await prisma.cashFlowEvent.deleteMany();
  await prisma.mappingConfig.deleteMany();
  await prisma.treasuryImportBatch.deleteMany();
  await prisma.bankBalance.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.payrollTaxConfig.deleteMany();
  await prisma.vukAmortismanConfig.deleteMany();
  await prisma.salesStageConfig.deleteMany();
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
  // Kategoriler artık TENANT'A ÖZEL (bkz. prisma/schema.prisma) — aynı 8
  // demo kategorisi HER tenant için ayrı satır olarak üretilir. `code` tenant
  // içinde kararlı anahtardır; id = "<tenantId>:<code>" (migration'ın ürettiği
  // biçimle BİREBİR aynı, böylece seed edilmiş ve taşınmış veriler ayrışmaz).
  const CATEGORY_TEMPLATE = [
    {
      code: "cat-gelir",
      name: "Satış Geliri",
      type: BudgetCategoryType.INCOME,
      sortOrder: 0,
    },
    {
      code: "cat-personel",
      name: "Personel Giderleri",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 1,
    },
    {
      code: "cat-pazarlama",
      name: "Pazarlama",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 2,
    },
    {
      code: "cat-kira",
      name: "Kira & Ofis",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 3,
    },
    {
      code: "cat-saas",
      name: "Yazılım & SaaS",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 4,
    },
    {
      code: "cat-seyahat",
      name: "Seyahat",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 5,
    },
    {
      code: "cat-diger",
      name: "Diğer Giderler",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 6,
    },
    {
      code: "cat-amortisman",
      name: "Amortisman Giderleri",
      type: BudgetCategoryType.EXPENSE,
      sortOrder: 7,
    },
  ];
  const SEED_TENANT_IDS = ["demo-tenant", "org-holding", "org-tr", "org-de", "org-us"];

  await prisma.budgetCategory.createMany({
    data: SEED_TENANT_IDS.flatMap((tenantId) =>
      CATEGORY_TEMPLATE.map((c) => ({ id: `${tenantId}:${c.code}`, tenantId, ...c })),
    ),
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

/**
 * 2026 mali yılı vergi/SGK parametreleri — KULLANICI TARAFINDAN VERİLEN
 * GERÇEK rakamlardır (kod içine gömülmez, bkz. schema.prisma'daki
 * PayrollTaxConfig yorumu). Değerler değiştiğinde SADECE bu fonksiyon
 * güncellenir, hesap motoruna (payroll-calculator.ts) DOKUNULMAZ.
 */
async function seedPayrollTaxConfig() {
  await prisma.payrollTaxConfig.create({
    data: {
      fiscalYear: 2026,
      minimumWageGrossMonthlyMinor: BigInt(3_303_000), // 33.030,00 TRY
      sgkCeilingMinor: BigInt(29_727_000), // 297.270,00 TRY (asgari ücretin 9 katı)
      severanceCeilingH1Minor: BigInt(6_494_877), // 64.948,77 TRY (Ocak-Haziran)
      severanceCeilingH2Minor: BigInt(7_372_987), // 73.729,87 TRY (Temmuz-Aralık)
      dailyMealAllowanceExemptMinor: BigInt(30_000), // 300,00 TRY
      dailyTransportAllowanceExemptMinor: BigInt(15_800), // 158,00 TRY
      employeeSgkRate: 0.14,
      employeeUnemploymentRate: 0.01,
      employerSgkRate: 0.2175,
      employerSgkIncentiveRate: 0.05,
      employerUnemploymentRate: 0.02,
      retiredEmployeeSgdpRate: 0.075,
      retiredEmployerSgdpRate: 0.245,
      incomeTaxBrackets: [
        { uptoAnnualMinor: 19_000_000, rate: 0.15 }, // 190.000 TRY'ye kadar
        { uptoAnnualMinor: 40_000_000, rate: 0.2 }, // 400.000 TRY'ye kadar
        { uptoAnnualMinor: 150_000_000, rate: 0.27 }, // 1.500.000 TRY'ye kadar
        { uptoAnnualMinor: 530_000_000, rate: 0.35 }, // 5.300.000 TRY'ye kadar
        { uptoAnnualMinor: null, rate: 0.4 }, // üzeri
      ],
      stampDutyRate: 0.00759,
      minimumWageIncomeTaxExemptionMonthlyMinor: BigInt(421_133), // 4.211,33 TRY
      minimumWageStampTaxExemptionMonthlyMinor: BigInt(25_070), // 250,70 TRY
      disabilityDeductionDegree1Minor: BigInt(1_200_000), // 12.000,00 TRY
      disabilityDeductionDegree2Minor: BigInt(700_000), // 7.000,00 TRY
      disabilityDeductionDegree3Minor: BigInt(300_000), // 3.000,00 TRY
      standardMonthlyWorkingHours: 225,
      overtimePremiumMultiplier: 1.5,
    },
  });
}

/**
 * VUK/TDHP amortisman oran tablosu — kullanıcının verdiği GERÇEK rakamlar
 * (bkz. prisma/schema.prisma'daki VukAmortismanConfig yorumu). Kod içine
 * GÖMÜLMEZ, `seedPayrollTaxConfig`teki AYNI "config veri, kod değil" felsefesi.
 */
async function seedVukAmortismanConfig() {
  await prisma.vukAmortismanConfig.createMany({
    data: [
      {
        category: "BUILDINGS",
        usefulLifeYears: 50,
        annualRate: 0.02,
        vukReference: "VUK G.T. 333 (1.1.1)",
      },
      {
        category: "MACHINERY_EQUIPMENT",
        usefulLifeYears: 10,
        annualRate: 0.1,
        vukReference: "VUK G.T. 333 (3.)",
      },
      {
        category: "VEHICLES",
        usefulLifeYears: 5,
        annualRate: 0.2,
        vukReference: "VUK G.T. 333 (6.)",
      },
      {
        category: "FURNITURE_FIXTURES",
        usefulLifeYears: 5,
        annualRate: 0.2,
        vukReference: "VUK G.T. 333 (55.)",
      },
      {
        category: "COMPUTER_HARDWARE",
        usefulLifeYears: 4,
        annualRate: 0.25,
        vukReference: "VUK G.T. 333 (54.)",
      },
      {
        // Varsayılan — belirli bir sözleşme süresi varsa FixedAsset.usefulLifeYearsOverride
        // ile geçersiz kılınır (rate = 1/süre). Bkz. fixed-asset.service.ts.
        category: "LEASEHOLD_IMPROVEMENTS",
        usefulLifeYears: 5,
        annualRate: 0.2,
        vukReference: "VUK G.T. 333 / GVK — sözleşme süresi belirsizse 5 yıl",
      },
    ],
  });
}

/**
 * Aşama -> varsayılan kazanma olasılığı tablosu — İŞ POLİTİKASI (VUK/SGK
 * gibi yasal zorunluluk DEĞİL), bkz. prisma/schema.prisma'daki SalesStageConfig
 * yorumu. `seedVukAmortismanConfig`teki AYNI "config veri, kod değil" felsefesi.
 */
async function seedSalesStageConfig() {
  await prisma.salesStageConfig.createMany({
    data: [
      { stage: "LEAD", defaultWinProbability: 0.1 },
      { stage: "QUALIFIED", defaultWinProbability: 0.25 },
      { stage: "PROPOSAL", defaultWinProbability: 0.5 },
      { stage: "NEGOTIATION", defaultWinProbability: 0.75 },
      { stage: "WON", defaultWinProbability: 1.0 },
      { stage: "LOST", defaultWinProbability: 0.0 },
    ],
  });
}

interface CompensationPayload {
  amountMinor: number;
  mealAllowanceDays: number;
  transportAllowanceDays: number;
  plannedOvertimeHoursPerMonth: number;
  applyEmployerIncentive: boolean;
}

function encryptCompensation(payload: CompensationPayload): string {
  return encrypt(JSON.stringify(payload));
}

/** Demo personel — sadece demo-tenant için (Personel ekranını uçtan uca deneyebilmek amacıyla). */
async function seedPersonnel() {
  const employees = [
    {
      id: "emp-elif",
      fullName: "Elif Mühendis",
      position: "Yazılım Mühendisi",
      department: "Ürün",
      hireDate: new Date("2023-01-15"),
      isRetired: false,
      isConcierge: false,
      disabilityDegree: "NONE" as const,
      compensation: {
        effectiveFrom: new Date("2026-01-01"),
        inputMode: "GROSS_FIXED" as const,
        payload: {
          amountMinor: toMinorUnits(90000),
          mealAllowanceDays: 20,
          transportAllowanceDays: 20,
          plannedOvertimeHoursPerMonth: 0,
          applyEmployerIncentive: false,
        },
      },
    },
    {
      id: "emp-kemal",
      fullName: "Kemal Usta",
      position: "Üretim Operatörü",
      department: "Üretim",
      hireDate: new Date("2020-06-01"),
      isRetired: false,
      isConcierge: false,
      disabilityDegree: "NONE" as const,
      compensation: {
        effectiveFrom: new Date("2026-01-01"),
        inputMode: "GROSS_FIXED" as const,
        payload: {
          amountMinor: toMinorUnits(45000),
          mealAllowanceDays: 22,
          transportAllowanceDays: 22,
          plannedOvertimeHoursPerMonth: 10,
          applyEmployerIncentive: true,
        },
      },
    },
    {
      id: "emp-nazan",
      fullName: "Nazan Danışman",
      position: "Mali Danışman",
      department: "Finans",
      hireDate: new Date("2024-03-01"),
      isRetired: true,
      isConcierge: false,
      disabilityDegree: "NONE" as const,
      compensation: {
        effectiveFrom: new Date("2026-01-01"),
        // Net sabit: sözleşmesi net 40.000 TRY üzerinden — brüt her ay
        // kümülatif matraha göre payroll-calculator.ts'teki netToGross ile
        // YENİDEN çözülür.
        inputMode: "NET_FIXED" as const,
        payload: {
          amountMinor: toMinorUnits(40000),
          mealAllowanceDays: 0,
          transportAllowanceDays: 0,
          plannedOvertimeHoursPerMonth: 0,
          applyEmployerIncentive: false,
        },
      },
    },
  ];

  for (const employee of employees) {
    await prisma.employee.create({
      data: {
        id: employee.id,
        tenantId: "demo-tenant",
        fullName: employee.fullName,
        position: employee.position,
        department: employee.department,
        hireDate: employee.hireDate,
        isRetired: employee.isRetired,
        isConcierge: employee.isConcierge,
        disabilityDegree: employee.disabilityDegree,
      },
    });

    await prisma.employeeCompensation.create({
      data: {
        id: crypto.randomUUID(),
        employeeId: employee.id,
        tenantId: "demo-tenant",
        effectiveFrom: employee.compensation.effectiveFrom,
        inputMode: employee.compensation.inputMode,
        compensationCiphertext: encryptCompensation(employee.compensation.payload),
      },
    });
  }
}

async function main() {
  await resetDatabase();
  await seedTenants();
  await seedUsersAndMemberships();
  await seedScenarios();
  await seedBudgetCategoriesAndLines();
  await seedFxRates();
  await seedPayrollTaxConfig();
  await seedVukAmortismanConfig();
  await seedSalesStageConfig();
  await seedPersonnel();
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
