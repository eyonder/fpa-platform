/** Yüklenen veriyi dosyanın KENDİ ara toplam satırlarıyla karşılaştırır.
 * Ara toplamlar yüklenmedi (çift sayım olurdu); doğru yüklendiyse
 * yapraklarının DB'deki toplamı o ara toplama EŞİT olmalıdır. */
import { config as loadEnv } from "dotenv";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_BYPASS_RLS ?? process.env.DATABASE_URL,
  }),
});

const num = (v: ExcelJS.CellValue): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "result" in v) {
    const r = (v as { result?: unknown }).result;
    return typeof r === "number" ? r : 0;
  }
  return 0;
};

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const ws = wb.worksheets[0];

  const file = new Map<string, { plan: number[]; tl: number[] }>();
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n < 3) return;
    const vals = row.values as ExcelJS.CellValue[];
    const label = String(vals[1] ?? "").trim();
    const m = label.match(/^([0-9][0-9.]*)-/);
    if (!m) return;
    const plan: number[] = [],
      tl: number[] = [];
    for (let i = 0; i < 12; i++) {
      plan.push(num(vals[2 + i * 4]));
      tl.push(num(vals[4 + i * 4]));
    }
    file.set(m[1], { plan, tl });
  });

  const cats = await prisma.budgetCategory.findMany({ where: { tenantId: "ritmus" } });
  const lines = await prisma.budgetLine.findMany({ where: { tenantId: "ritmus" } });
  const codeById = new Map(cats.map((c) => [c.id, c.code]));

  const planByCode = new Map<string, number>();
  const actualByCode = new Map<string, number>();
  for (const l of lines) {
    const code = codeById.get(l.categoryId)!;
    const amt = Number(l.amountMinor) / 100;
    const bucket = l.scenarioId === "ritmus-2026-plan-usd" ? planByCode : actualByCode;
    bucket.set(code, (bucket.get(code) ?? 0) + amt);
  }

  // 2 haneli kökler için: 3 haneli çocukların da yaprakları var; tüm alt ağacı topla
  // Kodun KENDİSİ yüklendiyse (çocuğu olmayan 3 haneli hesap: 800/830/831)
  // doğrudan onun değeri; aksi halde alt ağacın toplamı.
  const subtreeSum = (parent: string, m: Map<string, number>) => {
    if (m.has(parent)) return m.get(parent)!;
    return [...m.keys()]
      .filter(
        (c) => c !== parent && (c.startsWith(parent + ".") || c.startsWith(parent)),
      )
      .reduce((s, c) => s + (m.get(c) ?? 0), 0);
  };

  console.log("MUTABAKAT — dosyadaki ara toplam  vs  DB'deki yaprak toplamı\n");
  const checks = ["60", "62", "770", "800", "830", "831"];
  let allOk = true;
  for (const code of checks) {
    const f = file.get(code);
    if (!f) continue;
    const filePlan = f.plan.reduce((a, b) => a + b, 0);
    const fileTl = f.tl.slice(0, 8).reduce((a, b) => a + b, 0);
    const dbPlan = subtreeSum(code, planByCode);
    const dbTl = subtreeSum(code, actualByCode);
    const okP = Math.abs(filePlan - dbPlan) < 0.5;
    const okA = Math.abs(fileTl - dbTl) < 0.5;
    if (!okP || !okA) allOk = false;
    console.log(
      `${code.padEnd(5)} PLAN(USD) dosya=${filePlan.toFixed(2).padStart(14)} db=${dbPlan.toFixed(2).padStart(14)} ${okP ? "OK" : "FARK!"}`,
    );
    console.log(
      `${"".padEnd(5)} GERC(TRY) dosya=${fileTl.toFixed(2).padStart(14)} db=${dbTl.toFixed(2).padStart(14)} ${okA ? "OK" : "FARK!"}`,
    );
  }
  console.log(`\nTUM MUTABAKATLAR: ${allOk ? "TUTUYOR" : "FARK VAR"}`);

  const byMonth = await prisma.$queryRawUnsafe<
    Array<{ scenarioId: string; month: number; total: string }>
  >(`
    SELECT bl."scenarioId", bl.month, SUM(bl."amountMinor")::text AS total
    FROM "BudgetLine" bl WHERE bl."tenantId"='ritmus'
    GROUP BY 1,2 ORDER BY 1,2`);
  console.log("\nAY BAZINDA (kontrol):");
  for (const r of byMonth) {
    const cur = r.scenarioId.includes("usd") ? "USD" : "TRY";
    console.log(
      `  ${r.scenarioId.padEnd(24)} ay ${String(r.month).padStart(2)}  ${(Number(r.total) / 100).toFixed(2).padStart(16)} ${cur}`,
    );
  }
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
