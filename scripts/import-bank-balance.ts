/**
 * Banka hesap bakiyesi tablosunu sisteme yükler.
 *
 * VERİ KOD İÇİNDE DEĞİL: gerçek bakiyeler `data/` altındaki (gitignore'lu) bir
 * JSON dosyasından okunur. Depo HERKESE AÇIK — bir kez push edilen finansal
 * veri klon/fork/önbellekte kalıcıdır ve sonraki bir commit'te silmek geçmişten
 * temizlemez. Bu yüzden tutarlar burada GÖMÜLÜ DEĞİLDİR.
 *
 *   npx tsx scripts/import-bank-balance.ts data/bank-balance-2026-08-18.json
 *
 * `BankAccount` geldikten sonra kırılım GERÇEKTEN modellenir: her banka-para
 * birimi çifti AYRI bir hesap, her biri KENDİ para biriminde KENDİ bakiyesiyle.
 * (İlk sürümde konsolide TL toplam tek satır olarak yazılıyordu — kapsam
 * kesintileri #1/#2 geri alınınca bu script de yeniden yazıldı.)
 *
 * Kurlar da yüklenir: tablodaki GÜNCEL KUR değerleri, sistemdeki demo
 * USD/TRY kurlarının (34,10-34,30) GERÇEK karşılığıdır — bunlar olmadan
 * konsolidasyon ~%38 hatalı çevirir.
 */
import { readFileSync } from "node:fs";

import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_BYPASS_RLS ?? process.env.DATABASE_URL,
  }),
});

const USER_ID = "user-ritmus-finans";

interface BankRow {
  bank: string;
  tl: number;
  usd: number;
  eur: number;
  /** Tablodaki TL TOPLAM — hesaplananla karşılaştırılır, körlemesine güvenilmez. */
  statedTotalTl: number;
}

interface BalanceFile {
  asOfDate: string;
  tenantId: string;
  rates: Record<string, number>;
  statedGrandTotalTl: number;
  banks: BankRow[];
}

function loadBalanceFile(path: string): BalanceFile {
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as BalanceFile;
  if (!parsed.asOfDate || !parsed.tenantId || !Array.isArray(parsed.banks)) {
    throw new Error(
      `${path}: beklenen alanlar eksik (asOfDate, tenantId, rates, banks).`,
    );
  }
  return parsed;
}

function toMinor(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    throw new Error(
      "Kullanım: tsx scripts/import-bank-balance.ts <data/bank-balance-YYYY-MM-DD.json>",
    );
  }

  const file = loadBalanceFile(path);
  const { banks: BANKS, asOfDate: AS_OF, tenantId: TENANT_ID } = file;
  const USD_TRY = file.rates.USD;
  const EUR_TRY = file.rates.EUR;
  const STATED_GRAND_TOTAL_TL = file.statedGrandTotalTl;

  // --- 1. Satır bazında kur aritmetiğini doğrula (sessiz kabul YOK) ---
  let computedTotal = 0;
  for (const b of BANKS) {
    const computed = b.tl + b.usd * USD_TRY + b.eur * EUR_TRY;
    if (Math.abs(computed - b.statedTotalTl) > 0.05) {
      throw new Error(
        `${b.bank}: hesaplanan ${computed.toFixed(2)} != tablodaki ${b.statedTotalTl.toFixed(2)}`,
      );
    }
    computedTotal += b.statedTotalTl;
  }
  if (Math.abs(computedTotal - STATED_GRAND_TOTAL_TL) > 0.05) {
    throw new Error(
      `Genel toplam uyuşmuyor: ${computedTotal.toFixed(2)} != ${STATED_GRAND_TOTAL_TL.toFixed(2)}`,
    );
  }
  console.log(
    `Dogrulama OK — 9 banka, konsolide TL toplam ${computedTotal.toFixed(2)}`,
  );

  // --- 2. GERÇEK kurlar (demo kurlarının yerine) ---
  for (const [base, rate] of [
    ["USD", USD_TRY],
    ["EUR", EUR_TRY],
  ] as const) {
    await prisma.fxRate.upsert({
      where: { date_base_quote: { date: new Date(AS_OF), base, quote: "TRY" } },
      update: { rate },
      create: { date: new Date(AS_OF), base, quote: "TRY", rate },
    });
  }
  console.log(`Kur yuklendi: USD/TRY=${USD_TRY}  EUR/TRY=${EUR_TRY}  (${AS_OF})`);

  // --- 3. Hesaplar + hesap başına bakiye ---
  // Script yeniden çalıştırılabilir olsun diye önce temizle.
  await prisma.bankBalance.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.bankAccount.deleteMany({ where: { tenantId: TENANT_ID } });

  let sortOrder = 0;
  const created: Array<{ bank: string; currency: string; balance: number }> = [];

  for (const b of BANKS) {
    // SIFIR bakiyeli para birimi için hesap AÇILMAZ — kaynak tabloda "-" olan
    // hücre "o bankada o para biriminde hesabımız yok" demektir, "0 var" değil.
    const perCurrency: Array<[string, number]> = [
      ["TRY", b.tl],
      ["USD", b.usd],
      ["EUR", b.eur],
    ];

    for (const [currency, balance] of perCurrency) {
      if (balance === 0) continue;

      const account = await prisma.bankAccount.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: TENANT_ID,
          bankName: b.bank,
          currency,
          sortOrder: sortOrder++,
          createdByUserId: USER_ID,
          updatedAt: new Date(),
        },
      });

      await prisma.bankBalance.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: TENANT_ID,
          bankAccountId: account.id,
          asOfDate: new Date(AS_OF),
          balanceMinor: toMinor(balance),
          note: `${AS_OF} banka hesap bakiyesi tablosundan`,
          recordedByUserId: USER_ID,
        },
      });
      created.push({ bank: b.bank, currency, balance });
    }
  }

  console.log(`
${created.length} hesap + ${created.length} bakiye yazildi (${AS_OF}):`);
  for (const c of created) {
    console.log(
      `  ${c.bank.padEnd(24)} ${c.currency}  ${c.balance.toFixed(2).padStart(14)}`,
    );
  }

  const sumOf = (cur: string) =>
    created.filter((c) => c.currency === cur).reduce((s, c) => s + c.balance, 0);
  const tryTotal = sumOf("TRY");
  const usdTotal = sumOf("USD");
  const eurTotal = sumOf("EUR");
  console.log(
    `
Para birimi toplamlari : TRY ${tryTotal.toFixed(2)} | USD ${usdTotal.toFixed(2)} | EUR ${eurTotal.toFixed(2)}`,
  );
  console.log(
    `Kurla TL karsiligi     : ${(tryTotal + usdTotal * USD_TRY + eurTotal * EUR_TRY).toFixed(2)} (tabloda ${STATED_GRAND_TOTAL_TL.toFixed(2)})`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
