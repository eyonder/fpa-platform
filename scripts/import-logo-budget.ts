/**
 * Logo Bütçe (GERÇEKLEŞEN/Aylık) Excel dosyasını gerçek bir tenant olarak
 * sisteme yükler.
 *
 * Dosya GENİŞ formattadır: 1 hesap satırı × 12 ay × 4 metrik
 * (PLANLANAN | GERCEKLESEN | GERCEKLESEN (TL) | GRC/PLN % FARK).
 *
 * ÜÇ KRİTİK KURAL:
 *  1. SADECE YAPRAK hesaplar yüklenir. 60/600 gibi üst kırılımlar çocuklarının
 *     TOPLAMIDIR; hepsini yüklemek tutarları iki-üç kez saymak olurdu.
 *  2. GERÇEKLEŞEN sütunu TL DEĞİLDİR. GERCEKLESEN (TL) / GERCEKLESEN oranı
 *     Ocak→Ağustos 43.12→47.52 ilerliyor; dosyanın ana para birimi USD'dir.
 *     Bu yüzden PLAN senaryosu USD, GERÇEKLEŞEN senaryosu TL olarak AYRI
 *     senaryolara yazılır (kullanıcı kararı) — çevrim YAPILMAZ, hiçbir tutar
 *     türetilmez.
 *  3. EYLÜL-ARALIK AYLARINDA GERÇEKLEŞEN VERİ YOKTUR: o aylarda GERÇEKLEŞEN
 *     sütununa PLAN kopyalanmış ve TL sütunu 0 bırakılmıştır. Bu aylar
 *     gerçekleşen olarak YÜKLENMEZ — yüklenirse olmamış bir gerçekleşme
 *     uydurulmuş olurdu.
 */
import { config as loadEnv } from "dotenv";
import ExcelJS from "exceljs";
import { PrismaClient, BudgetCategoryType, ScenarioKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// prisma/seed.ts `prisma db seed` üzerinden çalıştığı için .env.local'i
// prisma.config.ts yükler; bu script doğrudan tsx ile çalıştığından kendisi yükler.
loadEnv({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_BYPASS_RLS ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const TENANT_ID = "ritmus";
const TENANT_NAME = "Ritmus Bilişim Teknolojileri A.Ş.";
const FISCAL_YEAR = 2026;
const SCENARIO_PLAN = "ritmus-2026-plan-usd";
const SCENARIO_ACTUAL = "ritmus-2026-actual-try";
const USER_ID = "user-ritmus-finans";
const USER_EMAIL = "finans@ritmus.test";

/** Toplam/memo satırları — hesap değil, hesaplanmış ara toplamlardır. */
const PSEUDO_CODES = new Set(["6666", "7777", "7", "8"]);

/** Gelir niteliğindeki kök hesaplar (geri kalanı gider). 603 (satış
 * indirimleri) ve 620.015/016, 770.067/068 gibi negatif satırlar KENDİ
 * grubunda İŞARETİYLE korunur — ayrı bir "kontra" tipi uydurulmaz. */
const INCOME_PREFIXES = ["60", "761", "762", "800"];

interface RawRow {
  rowNumber: number;
  code: string;
  name: string;
  /** [ay][0]=PLANLANAN(USD) [1]=GERCEKLESEN(USD) [2]=GERCEKLESEN(TL) */
  months: Array<[number, number, number]>;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
    }
    if ("result" in o) return String(o.result ?? "");
    return "";
  }
  return String(v);
}

function cellNumber(v: ExcelJS.CellValue): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in (v as object)) {
    const r = (v as { result?: unknown }).result;
    return typeof r === "number" ? r : 0;
  }
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function readWorkbook(path: string): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const rows: RawRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 3) return; // 1: ay başlıkları, 2: metrik başlıkları
    const values = row.values as ExcelJS.CellValue[]; // 1-index'li
    const label = cellText(values[1]).trim();
    if (!label) return;

    const match = label.match(/^([0-9][0-9.]*)-(.*)$/);
    if (!match) return;

    const months: Array<[number, number, number]> = [];
    for (let m = 0; m < 12; m++) {
      const base = 2 + m * 4; // values[1] etiket; her ay 4 sütun
      months.push([
        cellNumber(values[base]),
        cellNumber(values[base + 1]),
        cellNumber(values[base + 2]),
      ]);
    }
    rows.push({ rowNumber, code: match[1], name: match[2].trim(), months });
  });
  return rows;
}

/** Bir hesabın alt kırılımı var mı? (2 haneli -> 3 haneli çocuk, 3 haneli ->
 * "NNN.xxx" çocuk). Varsa o satır TOPLAMDIR ve yüklenmez. */
function isLeaf(code: string, allCodes: Set<string>): boolean {
  for (const other of allCodes) {
    if (other === code) continue;
    if (other.startsWith(`${code}.`)) return false;
    if (code.length === 2 && other.length === 3 && other.startsWith(code)) return false;
  }
  return true;
}

function categoryType(code: string): BudgetCategoryType {
  return INCOME_PREFIXES.some((p) => code.startsWith(p))
    ? BudgetCategoryType.INCOME
    : BudgetCategoryType.EXPENSE;
}

function toMinor(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

async function main() {
  const path = process.argv[2];
  if (!path)
    throw new Error("Kullanım: tsx scripts/import-logo-budget.ts <dosya.xlsx>");

  const raw = await readWorkbook(path);
  const allCodes = new Set(raw.map((r) => r.code));
  const leaves = raw.filter(
    (r) => !PSEUDO_CODES.has(r.code) && isLeaf(r.code, allCodes),
  );
  const skipped = raw.filter((r) => !leaves.includes(r));

  console.log(`Okunan satır: ${raw.length}`);
  console.log(`  yaprak (yüklenecek): ${leaves.length}`);
  console.log(`  ara toplam/memo (atlanan): ${skipped.length}`);
  console.log(`    -> ${skipped.map((s) => s.code).join(", ")}`);

  // --- temiz kurulum (yeniden çalıştırılabilir olsun) ---
  await prisma.budgetLine.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.budgetCategory.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.scenario.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.membership.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.session.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });

  await prisma.tenant.create({
    data: { id: TENANT_ID, name: TENANT_NAME, baseCurrency: "TRY" },
  });

  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      name: "Ritmus Finans",
      email: USER_EMAIL,
      // Şifre KOD İÇİNDE DEĞİL: ortam değişkeninden gelir (depo herkese açık).
      passwordHash: await bcrypt.hash(
        process.env.IMPORT_USER_PASSWORD ?? "ChangeMe!" + crypto.randomUUID(),
        10,
      ),
    },
  });
  await prisma.membership.create({
    data: { userId: USER_ID, tenantId: TENANT_ID, role: "ADMIN" },
  });

  await prisma.scenario.createMany({
    data: [
      {
        id: SCENARIO_PLAN,
        tenantId: TENANT_ID,
        name: "2026 Bütçe (PLANLANAN, USD)",
        kind: ScenarioKind.BUDGET,
        fiscalYear: FISCAL_YEAR,
        isLocked: false,
        baseCurrency: "USD",
        updatedAt: new Date(),
      },
      {
        id: SCENARIO_ACTUAL,
        tenantId: TENANT_ID,
        name: "2026 Gerçekleşen (Oca-Ağu, TRY)",
        kind: ScenarioKind.ACTUAL,
        fiscalYear: FISCAL_YEAR,
        isLocked: false,
        baseCurrency: "TRY",
        updatedAt: new Date(),
      },
    ],
  });

  // --- hesap planı: her yaprak hesap bir BudgetCategory ---
  await prisma.budgetCategory.createMany({
    data: leaves.map((r, index) => ({
      id: `${TENANT_ID}:${r.code}`,
      tenantId: TENANT_ID,
      code: r.code,
      name: `${r.code} ${r.name}`.slice(0, 200),
      type: categoryType(r.code),
      sortOrder: index,
    })),
  });

  // --- bütçe satırları ---
  const planLines = [];
  const actualLines = [];
  let planNonZero = 0;
  let actualNonZero = 0;

  for (const r of leaves) {
    for (let m = 0; m < 12; m++) {
      const [plan, , actualTl] = r.months[m];

      if (plan !== 0) planNonZero++;
      planLines.push({
        scenarioId: SCENARIO_PLAN,
        categoryId: `${TENANT_ID}:${r.code}`,
        month: m + 1,
        tenantId: TENANT_ID,
        amountMinor: toMinor(plan),
        updatedAt: new Date(),
      });

      // KURAL 3: Eylül-Aralık'ta gerçekleşen YOK (TL sütunu 0, GERÇEKLEŞEN'e
      // plan kopyalanmış). O aylar HİÇ yazılmaz — 0 bile yazılmaz, çünkü
      // "0 gerçekleşti" ile "henüz gerçekleşmedi" farklı şeylerdir.
      if (m <= 7) {
        if (actualTl !== 0) actualNonZero++;
        actualLines.push({
          scenarioId: SCENARIO_ACTUAL,
          categoryId: `${TENANT_ID}:${r.code}`,
          month: m + 1,
          tenantId: TENANT_ID,
          amountMinor: toMinor(actualTl),
          updatedAt: new Date(),
        });
      }
    }
  }

  await prisma.budgetLine.createMany({ data: planLines });
  await prisma.budgetLine.createMany({ data: actualLines });

  console.log(`\nKategori (hesap planı): ${leaves.length}`);
  console.log(
    `Plan satırı (USD, 12 ay):     ${planLines.length} (sıfırdan farklı: ${planNonZero})`,
  );
  console.log(
    `Gerçekleşen satırı (TRY, 1-8): ${actualLines.length} (sıfırdan farklı: ${actualNonZero})`,
  );

  const planTotal = leaves.reduce(
    (s, r) => s + r.months.reduce((a, m) => a + m[0], 0),
    0,
  );
  const actualTotal = leaves.reduce(
    (s, r) => s + r.months.slice(0, 8).reduce((a, m) => a + m[2], 0),
    0,
  );
  console.log(`\nKONTROL TOPLAMI (yaprak hesaplar):`);
  console.log(`  Plan 12 ay  : ${planTotal.toFixed(2)} USD`);
  console.log(`  Gerçek 1-8  : ${actualTotal.toFixed(2)} TRY`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
