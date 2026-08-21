import { NotFoundError } from "@/backend/core/errors";
import { resolveDisplayConversion } from "@/backend/modules/fx/display-currency";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type {
  CashFlowEvent,
  TreasuryPosition,
  TreasuryPositionDay,
  UnreconciledOverdue,
} from "@/shared/types";

import { bankService } from "./bank.service";
import { bankTransactionRepository } from "./bank-transaction.repository";
import { cashFlowEventRepository } from "./cash-flow-event.repository";
import { dateRange } from "./treasury.dates";
import { convertTransactionsByDay } from "./treasury-fx";
import { computeOpeningBalanceMinor, resolveWindow } from "./treasury-window";

/**
 * İŞ MANTIĞI KATMANI (Service) — NAKİT POZİSYONU.
 *
 * Faz 4.3 kapsamı: SADECE KALICI veriden (top bakiye + gerçek banka
 * hareketleri + PLANNED nakit olayları) türetilen bakiye eğrisi.
 * Satış/Capex/Bordro'dan TÜRETİLEN satırlar ve what-if simülasyonu Faz
 * 4.4'ün konusudur — bu servis onların da üzerine kurulacağı ÇEKİRDEK
 * formüldür.
 *
 * FORMÜL (plan §3.2):
 *   B0 = asOfDate <= startDate olan EN GÜNCEL BankBalance
 *   openingBalance = B0 + Σ BankTransaction(B0.asOfDate < valueDate <= startDate)
 *   closingBalance(d) = openingBalance
 *                     + Σ BankTransaction(startDate < valueDate <= d)
 *                     + Σ CashFlowEvent PLANNED(startDate < dueDate <= d)
 *
 * ÜÇ KURAL, üçü de kasıtlı:
 *  1. SADECE B0'dan SONRAKİ banka hareketleri sayılır — elle girilen top
 *     bakiye kendi gününe kadar olan her şeyi ZATEN içerir; öncekileri de
 *     saymak ÇİFT SAYMAKTIR.
 *  2. NEUTRALIZED olaylar tahmin toplamından ÇIKARILIR, çünkü karşılıkları
 *     artık gerçek banka toplamındadır. MEKANİZMANIN TAMAMI BUDUR.
 *     CANCELLED olaylar ise HİÇBİR toplama girmez.
 *  3. Vadesi `startDate`ten ÖNCE olup hâlâ PLANNED olan olaylar SESSİZCE
 *     DÜŞÜRÜLMEZ — ayrı bir `unreconciledOverdue` kovasında döner. Sessizce
 *     düşürmek, bir tahmini yavaşça iyimserleştirmenin en kolay yoludur.
 *
 * Tüm ara aritmetik KURUŞ (integer) üzerinden yapılır — 90 günlük kümülatif
 * toplamda float kayması gerçek bir risktir (bkz. shared/lib/money.ts).
 *
 * Pencere ve açılış bakiyesi aritmetiği `treasury-window.ts`tedir — Faz 4.4'ün
 * `treasury-projection.service.ts`i ile PAYLAŞILIR, iki ekranın açılış
 * bakiyesi asla ayrışmasın diye.
 */

export const treasuryBalanceService = {
  async position(
    tenantId: string,
    query: {
      scenarioId: string;
      startDate?: string;
      days?: number;
      displayCurrency?: string;
    },
  ): Promise<TreasuryPosition> {
    const scenario = await scenarioRepository.findById(tenantId, query.scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const { startDate, firstDay, endDate, horizonDays } = resolveWindow(
      query.startDate,
      query.days,
    );

    const [anchor, transactions, plannedEvents] = await Promise.all([
      bankService.resolveAnchor(tenantId, startDate, scenario.baseCurrency),
      // Çıpadan itibaren pencerenin sonuna kadar TÜM hareketler gerekir:
      // çıpa ile startDate arası açılış bakiyesini, sonrası günlük eğriyi kurar.
      bankTransactionRepository.findMany(tenantId, { toDate: endDate }),
      cashFlowEventRepository.findPlanned(tenantId, query.scenarioId),
    ]);

    const anchorDate = anchor?.asOfDate ?? null;

    // --- AÇILIŞ (kural 1) — bkz. treasury-window.ts. Çıpa artık ÇOKLU HESAP:
    // tutar zaten raporlama para birimine çevrilmiş halde geliyor. ---
    // Hareketler hesabın KENDİ para biriminde — çevrim treasury-fx.ts'te.
    const converted = await convertTransactionsByDay(
      transactions,
      scenario.baseCurrency,
    );
    const warnings = [...(anchor?.warnings ?? []), ...converted.warnings];

    const openingMinor = computeOpeningBalanceMinor(
      anchor ? { asOfDate: anchor.asOfDate, totalMinor: anchor.totalMinor } : null,
      converted.byDay,
      startDate,
    );

    // --- GÜNLÜK KOVALAR: startDate < d <= endDate ---
    const bankByDay = new Map<string, number>();
    for (const [date, minor] of converted.byDay) {
      if (anchorDate !== null && date <= anchorDate) continue;
      if (date <= startDate || date > endDate) continue;
      bankByDay.set(date, minor);
    }

    const plannedByDay = new Map<string, number>();
    const overdue: UnreconciledOverdue = { count: 0, inflowTotal: 0, outflowTotal: 0 };
    let overdueInflowMinor = 0;
    let overdueOutflowMinor = 0;

    for (const event of plannedEvents) {
      if (event.dueDate <= startDate) {
        // kural 3 — gün-0 toplamına KATILMAZ, ayrı kovada raporlanır.
        overdue.count++;
        if (event.direction === "INFLOW")
          overdueInflowMinor += toMinorUnits(event.amount);
        else overdueOutflowMinor += toMinorUnits(event.amount);
        continue;
      }
      if (event.dueDate > endDate) continue;
      plannedByDay.set(
        event.dueDate,
        (plannedByDay.get(event.dueDate) ?? 0) + signedEventMinor(event),
      );
    }

    overdue.inflowTotal = fromMinorUnits(overdueInflowMinor);
    overdue.outflowTotal = fromMinorUnits(overdueOutflowMinor);

    let runningMinor = openingMinor;
    const days: TreasuryPositionDay[] = [];

    for (const date of dateRange(firstDay, horizonDays)) {
      const bankMinor = bankByDay.get(date) ?? 0;
      const plannedMinor = plannedByDay.get(date) ?? 0;
      runningMinor += bankMinor + plannedMinor;
      days.push({
        date,
        bankActualNet: fromMinorUnits(bankMinor),
        plannedNet: fromMinorUnits(plannedMinor),
        closingBalance: fromMinorUnits(runningMinor),
      });
    }

    const firstNegativeDate = days.find((d) => d.closingBalance < 0)?.date ?? null;

    // Görüntüleme para birimi EN SON uygulanır (bkz. treasury-projection.service.ts).
    const display = await resolveDisplayConversion(
      scenario.baseCurrency,
      query.displayCurrency,
      startDate,
    );
    warnings.push(...display.warnings);
    const c = display.convert;

    return {
      scenarioId: query.scenarioId,
      startDate,
      endDate,
      anchor: anchor
        ? {
            asOfDate: anchor.asOfDate,
            balance: c(fromMinorUnits(anchor.totalMinor)),
            // Hesap kırılımı KENDİ para biriminde kalır — bir USD hesabını
            // "USD" etiketiyle TRY tutarında göstermek yanıltıcı olurdu.
            accounts: anchor.accounts,
          }
        : null,
      openingBalance: c(fromMinorUnits(openingMinor)),
      days:
        display.rate === 1
          ? days
          : days.map((d) => ({
              date: d.date,
              bankActualNet: c(d.bankActualNet),
              plannedNet: c(d.plannedNet),
              closingBalance: c(d.closingBalance),
            })),
      unreconciledOverdue: {
        count: overdue.count,
        inflowTotal: c(overdue.inflowTotal),
        outflowTotal: c(overdue.outflowTotal),
      },
      firstNegativeDate,
      currency: display.currency,
      warnings,
    };
  },
};

function signedEventMinor(event: CashFlowEvent): number {
  const minor = toMinorUnits(event.amount);
  return event.direction === "INFLOW" ? minor : -minor;
}
