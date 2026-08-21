import type { DerivedSalesMilestone } from "@/backend/modules/sales/sales-billing-milestone.repository";
import { roundMoney } from "@/shared/lib/money";
import type {
  BudgetCategory,
  FixedAsset,
  MonthlyPayrollCashTotal,
  ProjectionRow,
  SalesOpportunity,
} from "@/shared/types";

import { addDays } from "./treasury.dates";

/**
 * SAF TÜRETME FONKSİYONLARI — HTTP/Prisma/React bilmez, veritabanı olmadan
 * test edilebilir (`thp-mapping.ts`/`reconciliation.matcher.ts` ile aynı
 * disiplin). Çağıran (`treasury-projection.service.ts`) veriyi getirir,
 * burası sadece nakit satırına çevirir.
 *
 * ORTAK KURAL: türetilmiş satırlar Hazine'de DÜZENLENEMEZ (`editable: false`).
 * Sahibi başka bir modüldür (Satış/Sabit Kıymetler/Personel); burada
 * değiştirilirse iki modül sessizce ayrışır. Değiştirmek isteyen kullanıcı
 * kaynak modüle gider.
 */

// KOD (id DEĞİL): BudgetCategory tenant'a özeldir. Bu modül SAF olduğu için
// DB'ye gitmez — id'yi kendisine geçirilen kategori listesinden `code` ile
// çözer (bkz. resolveCategory).
export const SALES_CATEGORY_CODE = "cat-gelir";
export const CAPEX_CATEGORY_CODE = "cat-diger";
export const PAYROLL_CATEGORY_CODE = "cat-personel";

/**
 * BORDRO ÖDEME GÜNÜ KONVANSİYONU — SADECE HAZİNE KATMANINDA yaşar, Payroll
 * şemasına ASLA yazılmaz. `EmployeeCompensation.effectiveFrom` "bu ücret ne
 * zaman başlar" demektir, "ne zaman öderiz" DEMEZ; gün hassasiyetli bir nakit
 * tablosu içinse bir ödeme günü şarttır.
 *
 * M ayının tahakkuku M+1 ayında iki AYRI günde nakde döner. Tek kalem olarak
 * modellemek 90 günlük bir ödeme gücü tablosunda anlamlı bir hatadır.
 */
export const PAYROLL_NET_PAY_DAY = 5; // M+1 ayın 5'i — net maaşlar
export const PAYROLL_STATUTORY_PAY_DAY = 26; // M+1 ayın 26'sı — SGK + gelir + damga

/**
 * Hafta sonuna denk gelen ödeme gününü bir sonraki iş gününe kaydırır.
 *
 * UYARI: RESMİ TATİL TAKVİMİ MODELLENMEMİŞTİR (bkz. plan'daki kapsam notu
 * #9 — yıla göre değişen dini bayram verisi gerekir ve YANLIŞ veri, açıkça
 * belgelenmiş bir yaklaşıklıktan daha kötüdür).
 */
export function rollForwardOffWeekend(dateStr: string): string {
  const day = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
  if (day === 6) return addDays(dateStr, 2); // Cumartesi -> Pazartesi
  if (day === 0) return addDays(dateStr, 1); // Pazar -> Pazartesi
  return dateStr;
}

function payDate(fiscalYear: number, accrualMonth: number, dayOfMonth: number): string {
  const payMonth = accrualMonth === 12 ? 1 : accrualMonth + 1;
  const payYear = accrualMonth === 12 ? fiscalYear + 1 : fiscalYear;
  const iso = `${payYear}-${String(payMonth).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
  return rollForwardOffWeekend(iso);
}

/** Kod -> {id, name}. Kategori bulunamazsa kod hem id hem ad olarak kullanılır
 * (satır kaybolmasın; ekranda ham kod görünür ve sorun fark edilir). */
function resolveCategory(
  categories: BudgetCategory[],
  code: string,
): { id: string; name: string } {
  const match = categories.find((c) => c.code === code);
  return { id: match?.id ?? code, name: match?.name ?? code };
}

function inWindow(date: string, fromDate: string, toDate: string): boolean {
  return date >= fromDate && date <= toDate;
}

/** SATIŞ — zaten gün hassasiyetli, en kolay kaynak. WON fırsatların hakediş
 * faturalama tarihleri doğrudan tahsilat satırı olur. */
export function deriveSalesRows(
  milestones: DerivedSalesMilestone[],
  categories: BudgetCategory[],
): ProjectionRow[] {
  const category = resolveCategory(categories, SALES_CATEGORY_CODE);
  return milestones
    .filter((m) => m.amount > 0)
    .map((m) => ({
      rowId: `sales:${m.milestoneId}`,
      eventId: null,
      date: m.billingDate,
      direction: "INFLOW" as const,
      amount: roundMoney(m.amount),
      categoryId: category.id,
      categoryName: category.name,
      counterparty: m.customerName,
      description: `Hakediş — ${m.dealName}`,
      source: "SALES" as const,
      status: null,
      editable: false,
      accrualStartMonth: null,
    }));
}

/**
 * AÇIK PİPELINE — VARSAYILAN KAPALI (bkz. IncludeDerivedSources.pipeline).
 * Beklenen kapanış tarihinde, kazanma olasılığıyla ÇARPILMIŞ tutar. %40
 * olasılıklı bir fırsatı ödeme gücü tablosunda tam değeriyle göstermek
 * yanıltıcıdır; olasılıkla çarpıp göstermek bile bilinçli bir tercihtir.
 */
export function derivePipelineRows(
  opportunities: SalesOpportunity[],
  resolveWinProbability: (opportunity: SalesOpportunity) => number,
  categories: BudgetCategory[],
  fromDate: string,
  toDate: string,
): ProjectionRow[] {
  const category = resolveCategory(categories, SALES_CATEGORY_CODE);
  return opportunities
    .filter((o) => inWindow(o.expectedCloseDate, fromDate, toDate))
    .map((opportunity) => {
      const probability = resolveWinProbability(opportunity);
      return { opportunity, probability };
    })
    .filter(({ probability }) => probability > 0)
    .map(({ opportunity, probability }) => ({
      rowId: `pipeline:${opportunity.id}`,
      eventId: null,
      date: opportunity.expectedCloseDate,
      direction: "INFLOW" as const,
      amount: roundMoney(opportunity.expectedValue * probability),
      categoryId: category.id,
      categoryName: category.name,
      counterparty: opportunity.customerName,
      description: `Pipeline (%${Math.round(probability * 100)}) — ${opportunity.dealName}`,
      source: "PIPELINE" as const,
      status: null,
      editable: false,
      accrualStartMonth: null,
    }))
    .filter((row) => row.amount > 0);
}

/**
 * SABİT KIYMET (CAPEX) — `acquisitionDate` ZATEN ödeme günüdür; ayrı bir
 * ödeme tarihi alanı yoktur ve silinen `cash-flow.service.ts` de ikisini
 * özdeş kabul ediyordu.
 *
 * AMORTİSMAN BİLEREK DAHİL EDİLMEZ: nakit çıkışı DEĞİL, gelir tablosu
 * yüküdür ve tahakkuk katmanına aittir. Eklemek, `acquisitionDate`te zaten
 * sayılmış capex'i İKİNCİ KEZ saymak olurdu. (Silinen modül bunun TERSİNİ
 * yapıyordu — amortismanı geri ekliyordu; o mantık BURAYA TAŞINMAMALI.)
 */
export function deriveCapexRows(
  assets: FixedAsset[],
  categories: BudgetCategory[],
  fromDate: string,
  toDate: string,
): ProjectionRow[] {
  const category = resolveCategory(categories, CAPEX_CATEGORY_CODE);
  return assets
    .filter((a) => a.baseValue > 0 && inWindow(a.acquisitionDate, fromDate, toDate))
    .map((asset) => ({
      rowId: `capex:${asset.id}`,
      eventId: null,
      date: asset.acquisitionDate,
      direction: "OUTFLOW" as const,
      amount: roundMoney(asset.baseValue),
      categoryId: category.id,
      categoryName: category.name,
      counterparty: null,
      description: `Sabit kıymet — ${asset.assetName}`,
      source: "CAPEX" as const,
      status: null,
      editable: false,
      accrualStartMonth: null,
    }));
}

/** BORDRO — ayın tahakkuku, M+1'de İKİ ayrı ödemeye bölünür (bkz. yukarıdaki
 * konvansiyon notu). Girdi `payrollService.previewAggregate`ten gelir:
 * KİŞİSEL VERİ İÇERMEZ, sadece şirket düzeyinde aylık toplamlar. */
export function derivePayrollRows(
  fiscalYear: number,
  months: MonthlyPayrollCashTotal[],
  categories: BudgetCategory[],
  fromDate: string,
  toDate: string,
): ProjectionRow[] {
  const category = resolveCategory(categories, PAYROLL_CATEGORY_CODE);
  const rows: ProjectionRow[] = [];

  for (const month of months) {
    const key = `${fiscalYear}-${String(month.month).padStart(2, "0")}`;

    const netDate = payDate(fiscalYear, month.month, PAYROLL_NET_PAY_DAY);
    if (month.totalNet > 0 && inWindow(netDate, fromDate, toDate)) {
      rows.push({
        rowId: `payroll:${key}:net`,
        eventId: null,
        date: netDate,
        direction: "OUTFLOW",
        amount: roundMoney(month.totalNet),
        categoryId: category.id,
        categoryName: category.name,
        counterparty: null,
        description: `Net maaşlar (${key} tahakkuku)`,
        source: "PAYROLL",
        status: null,
        editable: false,
        accrualStartMonth: month.month,
      });
    }

    const statutoryDate = payDate(fiscalYear, month.month, PAYROLL_STATUTORY_PAY_DAY);
    if (month.totalStatutory > 0 && inWindow(statutoryDate, fromDate, toDate)) {
      rows.push({
        rowId: `payroll:${key}:statutory`,
        eventId: null,
        date: statutoryDate,
        direction: "OUTFLOW",
        amount: roundMoney(month.totalStatutory),
        categoryId: category.id,
        categoryName: category.name,
        counterparty: null,
        description: `SGK + vergi kesintileri (${key} tahakkuku)`,
        source: "PAYROLL",
        status: null,
        editable: false,
        accrualStartMonth: month.month,
      });
    }
  }

  return rows;
}

/**
 * ÇİFT SAYIM UYARISI — ASLA otomatik satır düşürmez.
 *
 * Bir hakediş, THP'den `120 Alıcılar` olarak da içe aktarılmış olabilir; bir
 * tedarikçi faturası hem elle hem `320` satırı olarak girilmiş olabilir.
 * Sezgisel bir kurala dayanıp bir satırı ödeme gücü tablosundan SESSİZCE
 * atmak, görünür bir uyarıdan çok daha tehlikelidir (bkz. plan kapsam notu #12).
 */
export function findPossibleDuplicates(
  persisted: ProjectionRow[],
  derived: ProjectionRow[],
): string[] {
  const warnings: string[] = [];

  for (const d of derived) {
    for (const p of persisted) {
      if (p.direction !== d.direction) continue;
      if (Math.abs(p.amount - d.amount) > 1) continue;
      if (Math.abs(daysBetween(p.date, d.date)) > 3) continue;
      warnings.push(
        `Olası çift kayıt: ${d.date} ${d.amount.toFixed(2)} (${d.source}) ile ` +
          `${p.date} tarihli "${p.counterparty ?? p.description ?? p.categoryName}" ` +
          `kaydı benzeşiyor. Otomatik olarak DÜŞÜLMEDİ — kontrol edin.`,
      );
      break; // aynı türetilmiş satır için tek uyarı yeter
    }
  }

  return warnings;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / 86_400_000,
  );
}
