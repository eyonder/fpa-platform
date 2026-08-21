import { NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { resolveDisplayConversion } from "@/backend/modules/fx/display-currency";
import { fixedAssetRepository } from "@/backend/modules/fixed-assets/fixed-asset.repository";
import { payrollService } from "@/backend/modules/personnel/payroll.service";
import { salesBillingMilestoneRepository } from "@/backend/modules/sales/sales-billing-milestone.repository";
import { salesOpportunityRepository } from "@/backend/modules/sales/sales-opportunity.repository";
import {
  loadSalesStageConfigMap,
  resolveWinProbability,
} from "@/backend/modules/sales/sales-opportunity.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type {
  ProjectionBucket,
  ProjectionRow,
  ProjectionSummary,
  TreasuryAdjustment,
  TreasuryProjection,
  UnreconciledOverdue,
} from "@/shared/types";

import { bankService } from "./bank.service";
import { bankTransactionRepository } from "./bank-transaction.repository";
import { cashFlowEventRepository } from "./cash-flow-event.repository";
import {
  deriveCapexRows,
  derivePayrollRows,
  derivePipelineRows,
  deriveSalesRows,
  findPossibleDuplicates,
} from "./treasury-derivations";
import { applyAdjustments, resolvePayrollRaise } from "./treasury-simulation";
import { dateRange } from "./treasury.dates";
import { convertTransactionsByDay } from "./treasury-fx";
import { computeOpeningBalanceMinor, resolveWindow } from "./treasury-window";

/**
 * İŞ MANTIĞI KATMANI (Service) — PROJEKSİYON & WHAT-IF.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez.
 *
 * TEK MOTOR, İKİ KAPI: `GET /api/treasury/projection` ve
 * `POST /api/treasury/simulate` AYNI `project()`i çağırır; GET sadece
 * `adjustments: []` geçer. Böylece bir simülasyonun kıyasladığı taban çizgi,
 * kullanıcının ekranda gördüğü tabandan ASLA ayrışamaz — iki ayrı kod yolu
 * olsaydı tam olarak orası sessizce kayardı.
 *
 * KALICI + TÜRETİLMİŞ: `CashFlowEvent` (kalıcı defter) yanında Satış
 * hakedişleri, Capex ve Bordro CANLI olarak kaynak modüllerinden türetilir
 * (bkz. treasury-derivations.ts) — kopyalanmaz, saklanmaz. Kaynak modülde bir
 * tarih değişirse projeksiyon bir sonraki istekte kendiliğinden düzelir.
 *
 * NÖTRLEME (Faz 4.3): `NEUTRALIZED` olaylar tahmin toplamına GİRMEZ ama
 * satır listesinde GÖRÜNÜR (üstü çizili) — gizlenselerdi bakiye
 * açıklanamaz hale gelirdi. `CANCELLED` olaylar hiçbir yerde görünmez.
 */

const DEFAULT_INCLUDE = { sales: true, capex: true, payroll: true, pipeline: false };

export interface ProjectionInput {
  scenarioId: string;
  startDate?: string;
  horizonDays?: number;
  granularity?: "DAY" | "WEEK";
  /** SUNUM para birimi — saklanan veriyi değiştirmez. */
  displayCurrency?: string;
  includeDerived?: {
    sales?: boolean;
    capex?: boolean;
    payroll?: boolean;
    pipeline?: boolean;
  };
  adjustments: TreasuryAdjustment[];
}

export const treasuryProjectionService = {
  async project(
    context: RequestContext,
    input: ProjectionInput,
  ): Promise<TreasuryProjection> {
    const scenario = await scenarioRepository.findById(
      context.tenantId,
      input.scenarioId,
    );
    if (!scenario) throw new NotFoundError("Senaryo");

    const { startDate, firstDay, endDate, horizonDays } = resolveWindow(
      input.startDate,
      input.horizonDays,
    );
    const granularity = input.granularity ?? "DAY";
    // DİKKAT: `{ ...DEFAULT_INCLUDE, ...input.includeDerived }` YAZILAMAZ —
    // spread, AÇIKÇA `undefined` olan anahtarları da KOPYALAR ve varsayılanı
    // ezer (GET route'u eksik querystring parametrelerini undefined geçirir).
    // Bu tam olarak canlı doğrulamada tüm türetilmiş kaynakların sessizce
    // kaybolmasına yol açtı; `??` ile alan alan çözülür.
    const requested = input.includeDerived ?? {};
    const include = {
      sales: requested.sales ?? DEFAULT_INCLUDE.sales,
      capex: requested.capex ?? DEFAULT_INCLUDE.capex,
      payroll: requested.payroll ?? DEFAULT_INCLUDE.payroll,
      pipeline: requested.pipeline ?? DEFAULT_INCLUDE.pipeline,
    };
    const warnings: string[] = [];

    const [categories, anchor, transactions, plannedEvents, windowEvents] =
      await Promise.all([
        budgetLineRepository.findCategories(context.tenantId),
        bankService.resolveAnchor(context.tenantId, startDate, scenario.baseCurrency),
        bankTransactionRepository.findMany(context.tenantId, { toDate: endDate }),
        cashFlowEventRepository.findPlanned(context.tenantId, input.scenarioId),
        cashFlowEventRepository.findByScenario(context.tenantId, input.scenarioId),
      ]);

    if (!anchor) {
      warnings.push(
        "Top bakiye girilmemiş — açılış bakiyesi 0 kabul edildi. " +
          "Hazine > Banka & Mutabakat ekranından girebilirsiniz.",
      );
    }

    // Çıpa ÇOKLU HESAP/PARA BİRİMİ: tutar raporlama birimine çevrilmiş gelir,
    // çevrilemeyen hesaplar için uyarı taşır (bkz. treasury-fx.ts).
    if (anchor) warnings.push(...anchor.warnings);

    // Hareketler hesabın KENDİ para biriminde; her biri KENDİ valör tarihindeki
    // kurla raporlama birimine çevrilir (bkz. treasury-fx.ts).
    const converted = await convertTransactionsByDay(
      transactions,
      scenario.baseCurrency,
    );
    warnings.push(...converted.warnings);

    const openingMinor = computeOpeningBalanceMinor(
      anchor ? { asOfDate: anchor.asOfDate, totalMinor: anchor.totalMinor } : null,
      converted.byDay,
      startDate,
    );

    // --- KALICI SATIRLAR: iptal edilenler HARİÇ, pencere içindekiler ---
    const persistedRows: ProjectionRow[] = windowEvents
      .filter(
        (event) =>
          event.status !== "CANCELLED" &&
          event.dueDate >= firstDay &&
          event.dueDate <= endDate,
      )
      .map((event) => ({
        rowId: `event:${event.id}`,
        eventId: event.id,
        date: event.dueDate,
        direction: event.direction,
        amount: event.amount,
        categoryId: event.categoryId,
        categoryName:
          categories.find((c) => c.id === event.categoryId)?.name ?? event.categoryId,
        counterparty: event.counterparty,
        description: event.description,
        source: event.source,
        status: event.status,
        // Nötrlenmiş satır düzenlenemez: karşılığı gerçekleşmiş bir banka
        // hareketidir, tahmini değiştirmek mutabakatı anlamsızlaştırırdı.
        editable: event.status === "PLANNED" && !scenario.isLocked,
        accrualStartMonth: event.accrualStartMonth,
      }));

    // --- TÜRETİLMİŞ SATIRLAR ---
    const derivedRows: ProjectionRow[] = [];

    if (include.sales) {
      const milestones = await salesBillingMilestoneRepository.findWonInWindow(
        context.tenantId,
        firstDay,
        endDate,
      );
      derivedRows.push(...deriveSalesRows(milestones, categories));
    }

    if (include.pipeline) {
      const [opportunities, stageConfig] = await Promise.all([
        salesOpportunityRepository.findOpen(context.tenantId),
        loadSalesStageConfigMap(),
      ]);
      derivedRows.push(
        ...derivePipelineRows(
          opportunities,
          (opportunity) =>
            resolveWinProbability(
              opportunity.stage,
              opportunity.winProbabilityOverride,
              stageConfig,
            ),
          categories,
          firstDay,
          endDate,
        ),
      );
      warnings.push(
        "Açık pipeline dahil edildi — bu satırlar OLASILIKLA ÇARPILMIŞ tahminlerdir, " +
          "bankadaki para değildir.",
      );
    }

    if (include.capex) {
      const assets = await fixedAssetRepository.findApproved(context.tenantId);
      derivedRows.push(...deriveCapexRows(assets, categories, firstDay, endDate));
    }

    const payrollAggregate = include.payroll
      ? await loadPayroll(context, input.scenarioId, null)
      : null;
    if (payrollAggregate) {
      derivedRows.push(
        ...derivePayrollRows(
          payrollAggregate.fiscalYear,
          payrollAggregate.months,
          categories,
          firstDay,
          endDate,
        ),
      );
    }

    warnings.push(...findPossibleDuplicates(persistedRows, derivedRows));

    const baselineRows = sortRows([...persistedRows, ...derivedRows]);

    // --- TABAN ÇİZGİ ---
    const bankByDay = windowBankDays(
      converted.byDay,
      anchor?.asOfDate ?? null,
      startDate,
      endDate,
    );
    const baseline = accumulate(
      baselineRows,
      bankByDay,
      openingMinor,
      firstDay,
      horizonDays,
      granularity,
    );

    // --- SİMÜLASYON ---
    let simulated: ProjectionBucket[] | null = null;
    let rows = baselineRows;

    if (input.adjustments.length > 0) {
      // PAYROLL_RAISE tutarı ÇARPARAK taklit EDİLEMEZ (artan oranlı vergi) —
      // gerçek bordro motoru yeni ücretle YENİDEN çalıştırılır.
      const raise = payrollAggregate
        ? resolvePayrollRaise(input.adjustments, payrollAggregate.fiscalYear)
        : null;

      let simulationBase = baselineRows;
      if (raise && payrollAggregate) {
        const raised = await loadPayroll(context, input.scenarioId, raise);
        simulationBase = [
          ...baselineRows.filter((row) => row.source !== "PAYROLL"),
          ...derivePayrollRows(
            raised.fiscalYear,
            raised.months,
            categories,
            firstDay,
            endDate,
          ),
        ];
      }

      const simulatedRows = applyAdjustments(
        simulationBase,
        input.adjustments,
        categories,
      ).filter((row) => row.date >= firstDay && row.date <= endDate);

      simulated = accumulate(
        simulatedRows,
        bankByDay,
        openingMinor,
        firstDay,
        horizonDays,
        granularity,
      );

      // Simülasyon AKTİFKEN hiçbir satır düzenlenemez: ekrandaki değerler
      // varsayımsaldır, kaydedilirse gerçek defter bozulur.
      rows = simulatedRows.map((row) => ({ ...row, editable: false }));
    }

    // --- GÖRÜNTÜLEME PARA BİRİMİ (sunum katmanı) ---
    // Çevrim EN SON yapılır: bütün hesaplar senaryonun kendi biriminde biter,
    // sadece dışarı verilen sayılar çevrilir. Araya girseydi kur, kümülatif
    // bakiyenin her adımında yeniden uygulanır ve yuvarlama birikirdi.
    const display = await resolveDisplayConversion(
      scenario.baseCurrency,
      input.displayCurrency,
      startDate,
    );
    warnings.push(...display.warnings);

    const c = display.convert;
    const convertBuckets = (buckets: ProjectionBucket[]) =>
      display.rate === 1
        ? buckets
        : buckets.map((b) => ({
            date: b.date,
            inflow: c(b.inflow),
            outflow: c(b.outflow),
            net: c(b.net),
            closingBalance: c(b.closingBalance),
          }));

    const displayedBaseline = convertBuckets(baseline);
    const displayedSimulated = simulated ? convertBuckets(simulated) : null;
    const displayedRows =
      display.rate === 1 ? rows : rows.map((r) => ({ ...r, amount: c(r.amount) }));

    return {
      scenarioId: input.scenarioId,
      startDate,
      endDate,
      granularity,
      currency: display.currency,
      openingBalance: c(fromMinorUnits(openingMinor)),
      openingBalanceAsOf: anchor?.asOfDate ?? null,
      rows: displayedRows,
      baseline: displayedBaseline,
      simulated: displayedSimulated,
      summary: summarize(displayedBaseline, displayedSimulated),
      unreconciledOverdue: (() => {
        const o = overdueBucket(plannedEvents, startDate);
        return {
          count: o.count,
          inflowTotal: c(o.inflowTotal),
          outflowTotal: c(o.outflowTotal),
        };
      })(),
      warnings,
    };
  },
};

async function loadPayroll(
  context: RequestContext,
  scenarioId: string,
  simulation: { grossMultiplier: number; effectiveFromMonth: number } | null,
) {
  // KİŞİSEL VERİSİZ kapı — `preview` DEĞİL `previewAggregate` (bkz.
  // payroll.service.ts dosya başı notu ve authorize.ts'teki payroll:read).
  return payrollService.previewAggregate(
    context,
    scenarioId,
    simulation ? { simulation } : undefined,
  );
}

function sortRows(rows: ProjectionRow[]): ProjectionRow[] {
  return [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.rowId.localeCompare(b.rowId),
  );
}

/** Çevrilmiş günlük net tutarları PENCEREYE kırpar — kural 1 (çıpa öncesi
 * sayılmaz, o gün zaten top bakiyenin içinde). */
function windowBankDays(
  byDay: Map<string, number>,
  anchorDate: string | null,
  startDate: string,
  endDate: string,
): Map<string, number> {
  const windowed = new Map<string, number>();
  for (const [date, minor] of byDay) {
    if (anchorDate !== null && date <= anchorDate) continue;
    if (date <= startDate || date > endDate) continue;
    windowed.set(date, minor);
  }
  return windowed;
}

/** ISO haftasının PAZARTESİsi — WEEK kırılımının kova anahtarı. */
function weekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day; // Pazar haftanın SONU sayılır
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Satırları + gerçekleşen banka hareketlerini günlük kovalara koyar, kümülatif
 * bakiyeyi yürütür. WEEK kırılımı İSTEMCİ TARAFI bir toplama DEĞİL, burada
 * yapılır — AG Grid'in satır gruplaması Enterprise özelliğidir ve toplamların
 * iki yerde hesaplanması ayrışma riskidir.
 */
function accumulate(
  rows: ProjectionRow[],
  bankByDay: Map<string, number>,
  openingMinor: number,
  firstDay: string,
  horizonDays: number,
  granularity: "DAY" | "WEEK",
): ProjectionBucket[] {
  const inflowByDay = new Map<string, number>();
  const outflowByDay = new Map<string, number>();

  for (const row of rows) {
    // Nötrlenmiş tahmin projeksiyona GİRMEZ — karşılığı zaten gerçekleşen
    // banka toplamındadır (Faz 4.3'ün tüm mekanizması budur).
    if (row.status === "NEUTRALIZED") continue;
    const minor = toMinorUnits(row.amount);
    const target = row.direction === "INFLOW" ? inflowByDay : outflowByDay;
    target.set(row.date, (target.get(row.date) ?? 0) + minor);
  }

  for (const [date, minor] of bankByDay) {
    const target = minor >= 0 ? inflowByDay : outflowByDay;
    target.set(date, (target.get(date) ?? 0) + Math.abs(minor));
  }

  const days = dateRange(firstDay, horizonDays);
  const buckets = new Map<string, { inflow: number; outflow: number }>();
  const order: string[] = [];

  for (const day of days) {
    const key = granularity === "WEEK" ? weekStart(day) : day;
    if (!buckets.has(key)) {
      buckets.set(key, { inflow: 0, outflow: 0 });
      order.push(key);
    }
    const bucket = buckets.get(key)!;
    bucket.inflow += inflowByDay.get(day) ?? 0;
    bucket.outflow += outflowByDay.get(day) ?? 0;
  }

  let runningMinor = openingMinor;
  return order.map((key) => {
    const { inflow, outflow } = buckets.get(key)!;
    const netMinor = inflow - outflow;
    runningMinor += netMinor;
    return {
      date: key,
      inflow: fromMinorUnits(inflow),
      outflow: fromMinorUnits(outflow),
      net: fromMinorUnits(netMinor),
      closingBalance: fromMinorUnits(runningMinor),
    };
  });
}

function summarize(
  baseline: ProjectionBucket[],
  simulated: ProjectionBucket[] | null,
): ProjectionSummary {
  const base = extremes(baseline);
  const sim = simulated ? extremes(simulated) : null;

  return {
    baselineMinBalance: base.minBalance,
    baselineMinDate: base.minDate,
    baselineClosing: base.closing,
    baselineFirstNegativeDate: base.firstNegativeDate,
    simulatedMinBalance: sim?.minBalance ?? null,
    simulatedMinDate: sim?.minDate ?? null,
    simulatedClosing: sim?.closing ?? null,
    simulatedFirstNegativeDate: sim?.firstNegativeDate ?? null,
    deltaClosing: sim ? round2(sim.closing - base.closing) : null,
    deltaMinBalance: sim ? round2(sim.minBalance - base.minBalance) : null,
  };
}

function extremes(buckets: ProjectionBucket[]) {
  if (buckets.length === 0) {
    return { minBalance: 0, minDate: null, closing: 0, firstNegativeDate: null };
  }
  let min = buckets[0];
  for (const bucket of buckets) {
    if (bucket.closingBalance < min.closingBalance) min = bucket;
  }
  return {
    minBalance: min.closingBalance,
    minDate: min.date,
    closing: buckets[buckets.length - 1].closingBalance,
    firstNegativeDate: buckets.find((b) => b.closingBalance < 0)?.date ?? null,
  };
}

/** Vadesi geçmiş ama hâlâ PLANNED olan tahminler — SESSİZCE DÜŞÜLMEZ
 * (bkz. treasury-balance.service.ts'teki aynı kural). */
function overdueBucket(
  plannedEvents: { dueDate: string; direction: string; amount: number }[],
  startDate: string,
): UnreconciledOverdue {
  let count = 0;
  let inflowMinor = 0;
  let outflowMinor = 0;

  for (const event of plannedEvents) {
    if (event.dueDate > startDate) continue;
    count++;
    if (event.direction === "INFLOW") inflowMinor += toMinorUnits(event.amount);
    else outflowMinor += toMinorUnits(event.amount);
  }

  return {
    count,
    inflowTotal: fromMinorUnits(inflowMinor),
    outflowTotal: fromMinorUnits(outflowMinor),
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
